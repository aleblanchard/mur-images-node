// Chapitre 9 : JavaScript dans le navigateur, sur la page d'une image.
// Chargé avec « defer » : le DOM est prêt quand ce code s'exécute.

// A. Zoom : clic gauche = +10 px de largeur, clic droit = -10 px
const mainImage = document.getElementById("mainImage");

mainImage.addEventListener("click", () => {
    mainImage.width = mainImage.width + 10;
});

mainImage.addEventListener("contextmenu", (e) => {
    e.preventDefault();               // pas de menu contextuel du navigateur
    if (mainImage.width > 50) {
        mainImage.width = mainImage.width - 10;
    }
});

// B. Le bouton « Commenter » reste désactivé tant que le commentaire est vide
const submitButton = document.getElementById("submitButton");
const commentaire = document.getElementById("commentaire");

function majBouton() {
    submitButton.disabled = commentaire.value.trim() === "";
}

submitButton.disabled = true;
commentaire.addEventListener("keyup", majBouton);
commentaire.addEventListener("input", majBouton);   // couvre aussi le copier-coller
