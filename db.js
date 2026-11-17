// Chapitre 8 : lien entre le serveur et la base PostgreSQL (driver « pg »).
// Un pool de connexions est ouvert une seule fois, et toutes les requêtes
// sont paramétrées ($1, $2...) pour éviter les injections SQL.
const { Pool } = require("pg");

const config = {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "application_image",
};

const pool = new Pool(config);

// Colonnes communes aux requêtes sur les images
const SELECT_IMAGE = `
    SELECT i.id, i.nom, i.date, i.fichier, i.likes,
           o.nom AS orientation,
           a.prenom || ' ' || a.nom AS auteur
    FROM images AS i
    JOIN orientations AS o ON i.orientation = o.id
    JOIN auteurs AS a      ON i.auteur = a.id`;

async function dernieresImages(n = 3) {
    const { rows } = await pool.query(`${SELECT_IMAGE} ORDER BY i.date DESC, i.id DESC LIMIT $1`, [n]);
    return rows;
}

async function toutesLesImages() {
    const { rows } = await pool.query(`${SELECT_IMAGE} ORDER BY i.id`);
    return rows;
}

async function image(id) {
    const { rows } = await pool.query(`${SELECT_IMAGE} WHERE i.id = $1`, [id]);
    return rows[0] || null;
}

// Images voisines (précédente et suivante) dans l'ordre des identifiants
async function voisines(id) {
    const { rows } = await pool.query(
        `SELECT
            (SELECT row_to_json(p) FROM (SELECT id, fichier FROM images WHERE id < $1 ORDER BY id DESC LIMIT 1) p) AS precedente,
            (SELECT row_to_json(s) FROM (SELECT id, fichier FROM images WHERE id > $1 ORDER BY id ASC  LIMIT 1) s) AS suivante`,
        [id]);
    return rows[0];
}

async function commentaires(idImage) {
    const { rows } = await pool.query(
        "SELECT texte, date FROM commentaires WHERE id_image = $1 ORDER BY date, id", [idImage]);
    return rows;
}

async function ajouterCommentaire(idImage, texte) {
    await pool.query("INSERT INTO commentaires (texte, id_image) VALUES ($1, $2)", [texte, idImage]);
}

// --- Comptes (chapitre 10) ---
async function compteParNom(username) {
    const { rows } = await pool.query("SELECT id, username, salt, hash FROM accounts WHERE username = $1", [username]);
    return rows[0] || null;
}

async function creerCompte(username, salt, hash) {
    const { rows } = await pool.query(
        "INSERT INTO accounts (username, salt, hash) VALUES ($1, $2, $3) RETURNING id", [username, salt, hash]);
    return rows[0].id;
}

// --- Likes (chapitre 10) ---
async function imagesAimees(idAccount) {
    const { rows } = await pool.query("SELECT id_image FROM accounts_images_likes WHERE id_account = $1", [idAccount]);
    return new Set(rows.map(r => r.id_image));
}

// Renvoie true si le like a été ajouté, false si l'image était déjà aimée.
// Transaction : l'ajout dans la table de likes et le compteur restent cohérents.
async function aimer(idAccount, idImage) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const res = await client.query(
            `INSERT INTO accounts_images_likes (id_account, id_image) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`, [idAccount, idImage]);
        if (res.rowCount === 1) {
            await client.query("UPDATE images SET likes = likes + 1 WHERE id = $1", [idImage]);
        }
        await client.query("COMMIT");
        return res.rowCount === 1;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    pool, config,
    dernieresImages, toutesLesImages, image, voisines, commentaires, ajouterCommentaire,
    compteParNom, creerCompte, imagesAimees, aimer,
};
