// Génération des pages HTML (chapitres 4, 5, 8 et 10).
// Tout texte venant de l'utilisateur ou de la base passe par echapper()
// pour éviter l'injection de HTML / JavaScript (faille XSS).

function echapper(texte) {
    return String(texte)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const miniature = fichier => "/public/images/" + fichier.replace(/\.jpg$/, "_small.jpg");
const grande = fichier => "/public/images/" + fichier;

function formaterDate(date) {
    return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Barre en haut à droite : liens d'inscription/connexion, ou nom + déconnexion
function barreCompte(utilisateur) {
    if (utilisateur) {
        return `<nav class="compte">Connecté en tant que <strong>${echapper(utilisateur)}</strong>
            · <a href="/logout">Déconnexion</a></nav>`;
    }
    return `<nav class="compte"><a href="/signup">Inscription</a> · <a href="/signin">Connexion</a></nav>`;
}

function page({ titre, utilisateur, contenu, scripts = "" }) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${echapper(titre)} — Mur d'images</title>
    <link rel="stylesheet" href="/public/style.css">
    ${scripts}
</head>
<body>
    <header>
        <a href="/" class="accueil">Mur d'images</a>
        ${barreCompte(utilisateur)}
    </header>
    <main>
${contenu}
    </main>
</body>
</html>`;
}

function accueil({ utilisateur, images }) {
    const bandeau = images.map(img => `
            <a href="/page-image/${img.id}"><img src="${miniature(img.fichier)}" alt="${echapper(img.nom)}"></a>`).join("");
    return page({
        titre: "Accueil", utilisateur, contenu: `
        <div class="logo"><img src="/public/images/logo.png" alt="Logo"></div>
        ${utilisateur ? `<p class="bienvenue">Bonjour ${echapper(utilisateur)} !</p>` : ""}
        <p>Voici les dernières photos ajoutées :</p>
        <div class="bandeau">${bandeau}
        </div>
        <p><a class="bouton" href="/images">Voir toutes les images</a></p>`,
    });
}

function mur({ utilisateur, images, aimees }) {
    const cases = images.map(img => {
        let like = "";
        if (utilisateur) {
            like = aimees.has(img.id)
                ? `<span class="liked">liked</span>`
                : `<a class="like" href="/like/${img.id}">like</a>`;
        }
        return `
            <figure>
                <a href="/page-image/${img.id}"><img src="${miniature(img.fichier)}" alt="${echapper(img.nom)}"></a>
                <figcaption>${echapper(img.nom)} · ${img.likes} ♥ ${like}</figcaption>
            </figure>`;
    }).join("");
    return page({
        titre: "Mur d'images", utilisateur, contenu: `
        <p><a class="bouton" href="/">← Accueil</a></p>
        <h1>Mur d'images</h1>
        ${utilisateur ? "" : `<p class="info"><a href="/signin">Connectez-vous</a> pour aimer des images.</p>`}
        <div class="mur">${cases}
        </div>`,
    });
}

function pageImage({ utilisateur, img, commentaires, voisines }) {
    const liste = commentaires.length
        ? commentaires.map(c => `<li>${echapper(c.texte)}</li>`).join("\n                ")
        : `<li class="vide">Aucun commentaire pour le moment.</li>`;
    const vignette = (v, sens) => v
        ? `<a href="/page-image/${v.id}" class="${sens}"><img src="${miniature(v.fichier)}" alt="Image ${sens}"></a>`
        : `<span class="${sens}"></span>`;
    return page({
        titre: img.nom, utilisateur,
        scripts: `<script src="/public/page-image.js" defer></script>`,
        contenu: `
        <p><a class="bouton" href="/images">← Mur</a></p>
        <h1>${echapper(img.nom)}</h1>
        <p class="meta">${echapper(img.auteur)} · ${formaterDate(img.date)} · ${echapper(img.orientation)} · ${img.likes} ♥</p>
        <div class="grande">
            <img id="mainImage" src="${grande(img.fichier)}" width="400" alt="${echapper(img.nom)}"
                 title="Clic gauche : agrandir · clic droit : réduire">
        </div>
        <section class="commentaires">
            <h2>Commentaires</h2>
            <ul>
                ${liste}
            </ul>
            <form action="/image-description" method="post">
                <input type="hidden" name="imageId" value="${img.id}">
                <label for="commentaire">Ajouter un commentaire</label>
                <textarea id="commentaire" name="comment" rows="3" maxlength="500" required></textarea>
                <button id="submitButton" type="submit">Commenter</button>
            </form>
        </section>
        <nav class="voisines">
            ${vignette(voisines.precedente, "precedente")}
            ${vignette(voisines.suivante, "suivante")}
        </nav>`,
    });
}

function formulaireCompte({ mode, utilisateur, erreur = "", username = "" }) {
    const inscription = mode === "signup";
    return page({
        titre: inscription ? "Inscription" : "Connexion", utilisateur, contenu: `
        <h1>${inscription ? "Inscription" : "Connexion"}</h1>
        ${erreur ? `<p class="erreur">${echapper(erreur)}</p>` : ""}
        <form class="compte-form" action="/${mode}" method="post">
            <label for="username">Nom d'utilisateur</label>
            <input id="username" name="username" value="${echapper(username)}" required maxlength="30" autocomplete="username">
            <label for="password">Mot de passe${inscription ? " (8 caractères minimum)" : ""}</label>
            <input id="password" name="password" type="password" required
                   autocomplete="${inscription ? "new-password" : "current-password"}">
            <button type="submit">${inscription ? "Créer mon compte" : "Se connecter"}</button>
        </form>
        <p>${inscription
            ? `Déjà inscrit ? <a href="/signin">Se connecter</a>`
            : `Pas encore de compte ? <a href="/signup">S'inscrire</a>`}</p>`,
    });
}

function erreur({ utilisateur, code, message }) {
    return page({
        titre: `Erreur ${code}`, utilisateur, contenu: `
        <h1>Erreur ${code}</h1>
        <p>${echapper(message)}</p>
        <p><a class="bouton" href="/">Retour à l'accueil</a></p>`,
    });
}

module.exports = { echapper, accueil, mur, pageImage, formulaireCompte, erreur };
