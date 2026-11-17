// Tests de bout en bout : le serveur tourne contre une vraie base PostgreSQL.
// Prérequis : PostgreSQL lancé (variables PG* comme pour le serveur).
// La base est réinitialisée avant les tests avec scripts/init-db.js.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

let server, base, db;

before(async () => {
    execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "init-db.js")], { stdio: "ignore" });
    server = require("../server");
    db = require("../db");
    await new Promise(r => server.listen(0, r));
    base = `http://localhost:${server.address().port}`;
});

after(async () => {
    await new Promise(r => server.close(r));
    await db.pool.end();
});

// Petit client HTTP qui garde le cookie de session
function client() {
    let cookie = "";
    return async (url, options = {}) => {
        const res = await fetch(base + url, {
            redirect: "manual",
            ...options,
            headers: { ...(options.headers || {}), ...(cookie ? { cookie } : {}) },
        });
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) cookie = setCookie.split(";")[0];
        return { res, texte: await res.text() };
    };
}

const formulaire = donnees => ({
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(donnees).toString(),
});

test("ch. 4 : fichiers statiques sous /public avec le bon type", async () => {
    const get = client();
    let { res } = await get("/public/style.css");
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/css/);
    ({ res } = await get("/public/images/image1_small.jpg"));
    assert.strictEqual(res.headers.get("content-type"), "image/jpeg");
    ({ res } = await get("/public/inexistant.png"));
    assert.strictEqual(res.status, 404);
});

test("sécurité : impossible de lire un fichier hors de /public", async () => {
    const get = client();
    for (const url of ["/public/../server.js", "/public/%2e%2e/db.js", "/public/..%2fpackage.json"]) {
        const { res, texte } = await get(url);
        assert.ok([403, 404].includes(res.status), url);
        assert.ok(!texte.includes("require("), url);
    }
});

test("ch. 8 : l'accueil affiche les 3 images les plus récentes", async () => {
    const { res, texte } = await client()("/");
    assert.strictEqual(res.status, 200);
    const liens = [...texte.matchAll(/href="\/page-image\/(\d+)"/g)].map(m => m[1]);
    assert.deepStrictEqual(liens, ["10", "9", "8"]);
    assert.match(texte, /href="\/signup"/);
    assert.match(texte, /href="\/signin"/);
});

test("ch. 4 et 8 : le mur liste toutes les images de la base", async () => {
    const { texte } = await client()("/images");
    const ids = [...texte.matchAll(/href="\/page-image\/(\d+)"/g)].map(m => Number(m[1]));
    assert.deepStrictEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(!texte.includes('href="/like/'), "pas de like sans connexion");
});

test("ch. 4 et 8 : page d'une image avec titre, voisines et script", async () => {
    const get = client();
    let { res, texte } = await get("/page-image/5");
    assert.strictEqual(res.status, 200);
    assert.match(texte, /Arbres du désert/);
    assert.match(texte, /href="\/page-image\/4"/);
    assert.match(texte, /href="\/page-image\/6"/);
    assert.match(texte, /id="mainImage"/);
    assert.match(texte, /src="\/public\/page-image\.js" defer/);
    ({ res } = await get("/page-image/999"));
    assert.strictEqual(res.status, 404);
    ({ texte } = await get("/page-image/1"));
    assert.ok(!texte.includes('href="/page-image/0"'), "pas d'image précédente pour la première");
});

test("ch. 5 et 8 : un commentaire est enregistré en base puis affiché (302)", async () => {
    const get = client();
    const { res } = await get("/image-description", formulaire({ imageId: "2", comment: "Belle lumière !" }));
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get("location"), "/page-image/2");
    const { texte } = await get("/page-image/2");
    assert.match(texte, /Belle lumière !/);
    const { rows } = await db.pool.query("SELECT texte FROM commentaires WHERE id_image = 2");
    assert.ok(rows.some(r => r.texte === "Belle lumière !"));
});

test("sécurité : un commentaire contenant du HTML est échappé", async () => {
    const get = client();
    await get("/image-description", formulaire({ imageId: "3", comment: "<script>alert(1)</script>" }));
    const { texte } = await get("/page-image/3");
    assert.ok(!texte.includes("<script>alert(1)</script>"));
    assert.match(texte, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("un commentaire vide n'est pas enregistré", async () => {
    const avant = (await db.pool.query("SELECT COUNT(*)::int n FROM commentaires")).rows[0].n;
    await client()("/image-description", formulaire({ imageId: "4", comment: "   " }));
    const apres = (await db.pool.query("SELECT COUNT(*)::int n FROM commentaires")).rows[0].n;
    assert.strictEqual(apres, avant);
});

test("ch. 10 : inscription, mot de passe haché, nom affiché, déconnexion", async () => {
    const get = client();
    let { res, texte } = await get("/signup", formulaire({ username: "alexis", password: "motdepasse1" }));
    assert.strictEqual(res.status, 302);
    ({ texte } = await get("/"));
    assert.match(texte, /Connecté en tant que <strong>alexis<\/strong>/);
    assert.match(texte, /href="\/logout"/);
    assert.ok(!texte.includes('href="/signin"'), "liens masqués une fois connecté");

    const { rows } = await db.pool.query("SELECT salt, hash FROM accounts WHERE username = 'alexis'");
    assert.strictEqual(rows[0].hash.length, 64);
    assert.ok(!rows[0].hash.toString("latin1").includes("motdepasse1"));

    ({ res } = await get("/logout"));
    ({ texte } = await get("/"));
    assert.match(texte, /href="\/signin"/);
});

test("ch. 10 : connexion refusée avec un mauvais mot de passe, acceptée sinon", async () => {
    const get = client();
    let { res, texte } = await get("/signin", formulaire({ username: "alexis", password: "faux" }));
    assert.strictEqual(res.status, 400);
    assert.match(texte, /incorrect/);
    ({ res } = await get("/signin", formulaire({ username: "alexis", password: "motdepasse1" })));
    assert.strictEqual(res.status, 302);
    ({ texte } = await get("/"));
    assert.match(texte, /alexis/);
});

test("ch. 10 : inscription refusée si le nom est pris ou le mot de passe trop court", async () => {
    const get = client();
    let { res, texte } = await get("/signup", formulaire({ username: "alexis", password: "autremotdepasse" }));
    assert.strictEqual(res.status, 400);
    assert.match(texte, /déjà pris/);
    ({ res } = await get("/signup", formulaire({ username: "nouveau", password: "court" })));
    assert.strictEqual(res.status, 400);
});

test("ch. 10 : un utilisateur connecté aime une image une seule fois", async () => {
    const get = client();
    let { res, texte } = await get("/like/1");
    assert.strictEqual(res.headers.get("location"), "/signin", "like interdit sans connexion");

    await get("/signin", formulaire({ username: "alexis", password: "motdepasse1" }));
    const avant = (await db.image(1)).likes;
    ({ texte } = await get("/images"));
    assert.match(texte, /href="\/like\/1"/);

    ({ res } = await get("/like/1"));
    assert.strictEqual(res.headers.get("location"), "/images");
    await get("/like/1");                                    // deuxième essai : ignoré
    assert.strictEqual((await db.image(1)).likes, avant + 1);

    ({ texte } = await get("/images"));
    assert.ok(!texte.includes('href="/like/1"'), "plus de lien like sur l'image aimée");
    assert.match(texte, /class="liked">liked</);
    assert.match(texte, /href="\/like\/2"/);
});

test("le cookie de session est HttpOnly et imprévisible", async () => {
    const res = await fetch(base + "/", { redirect: "manual" });
    const cookie = res.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /session-id=[0-9a-f-]{36}/);
});

test("route inconnue : erreur 404", async () => {
    const { res } = await client()("/nimporte-quoi");
    assert.strictEqual(res.status, 404);
});
