-- =====================================================================
-- Base « application_image » — schéma et données (chapitres 6, 8 et 10)
-- À exécuter dans la base application_image (npm run init-db le fait).
-- Le script peut être rejoué : il recrée les tables à chaque fois.
-- =====================================================================

DROP TABLE IF EXISTS accounts_images_likes;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS commentaires;
DROP TABLE IF EXISTS images;
DROP TABLE IF EXISTS orientations;
DROP TABLE IF EXISTS auteurs;

-- Étape 2 : auteurs
CREATE TABLE auteurs (
    id      SERIAL PRIMARY KEY,
    nom     VARCHAR(100) NOT NULL,
    prenom  VARCHAR(100) NOT NULL
);

-- Étape 3
INSERT INTO auteurs (prenom, nom) VALUES
    ('Marcel', 'Duchamp'),
    ('Elisa', 'Von Gloeden');

-- Étape 4 : orientations (table séparée pour éviter la redondance)
CREATE TABLE orientations (
    id   SERIAL PRIMARY KEY,
    nom  VARCHAR(20) NOT NULL UNIQUE
);

INSERT INTO orientations (nom) VALUES ('portrait'), ('paysage');

-- Étape 5 : images (le fichier reste sur le disque, ses informations sont en base)
CREATE TABLE images (
    id           SERIAL PRIMARY KEY,
    nom          VARCHAR(200) NOT NULL,
    date         DATE NOT NULL,
    orientation  INT NOT NULL REFERENCES orientations(id),
    fichier      VARCHAR(200) NOT NULL UNIQUE,
    likes        INT NOT NULL DEFAULT 0 CHECK (likes >= 0),
    auteur       INT NOT NULL REFERENCES auteurs(id)
);

-- Étape 6 : données des images (fichiers dans public/images/)
INSERT INTO images (nom, date, orientation, fichier, likes, auteur) VALUES
    ('Reflets bleus',          '2021-03-14', 1, 'image1.jpg',  12, 2),
    ('Promenade au bord de mer','2021-07-02', 1, 'image2.jpg',   5, 1),
    ('Canyon de lumière',      '2021-11-20', 2, 'image3.jpg',  18, 1),
    ('Sphères pastel',         '2022-02-08', 1, 'image4.jpg',   7, 2),
    ('Arbres du désert',       '2022-05-30', 2, 'image5.jpg',  21, 1),
    ('La grotte',              '2022-09-12', 2, 'image6.jpg',   9, 2),
    ('Écrans de nuit',         '2023-01-25', 1, 'image7.jpg',   3, 1),
    ('Le bol de ramen',        '2023-06-04', 1, 'image8.jpg',  14, 2),
    ('Lumières floues',        '2023-10-17', 1, 'image9.jpg',   2, 1),
    ('Sur le tournage',        '2024-02-29', 2, 'image10.jpg', 11, 2);

-- Étape 7 : commentaires
CREATE TABLE commentaires (
    id        SERIAL PRIMARY KEY,
    texte     VARCHAR(500) NOT NULL,
    id_image  INT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    date      TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO commentaires (texte, id_image) VALUES
    ('Superbes couleurs !', 1),
    ('On dirait une peinture.', 3),
    ('J''adore la lumière qui traverse la grotte.', 6);

-- Chapitre 10 : comptes (le mot de passe n'est jamais stocké en clair)
CREATE TABLE accounts (
    id        SERIAL PRIMARY KEY,
    username  VARCHAR(100) NOT NULL UNIQUE,
    salt      BYTEA NOT NULL,
    hash      BYTEA NOT NULL
);

-- Chapitre 10 : likes des utilisateurs (un compte ne peut aimer une image qu'une fois)
CREATE TABLE accounts_images_likes (
    id_account  INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    id_image    INT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    PRIMARY KEY (id_account, id_image)
);
