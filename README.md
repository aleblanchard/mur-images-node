# Mur d'images — Node.js natif et PostgreSQL

[![Tests](https://github.com/aleblanchard/mur-images-node/actions/workflows/tests.yml/badge.svg)](https://github.com/aleblanchard/mur-images-node/actions/workflows/tests.yml)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Sans framework](https://img.shields.io/badge/framework-aucun-lightgrey)

Galerie de photos avec commentaires, comptes utilisateurs et likes. Le serveur est écrit avec le seul module `http` de Node.js, sans framework, et les données sont stockées dans PostgreSQL.

Projet de programmation web réalisé à l'Université de Bordeaux, en suivant les chapitres 1 à 10 de [Vanilla Academy](https://vanillacademy.com/chapitre/1).

## Fonctionnalités

- **Accueil** avec les trois photos les plus récentes
- **Mur d'images** responsive : 5 colonnes sur grand écran, 3 sur écran moyen, 1 sur téléphone
- **Page de chaque image** : titre, auteur, date, orientation, nombre de likes, images précédente et suivante
- **Commentaires** enregistrés en base, ajoutés depuis la page de l'image
- **Zoom** sur l'image : clic gauche pour agrandir, clic droit pour réduire
- Bouton **Commenter** désactivé tant que le commentaire est vide
- **Comptes** : inscription, connexion, déconnexion, nom affiché en haut à droite
- **Likes** : un utilisateur connecté aime une image une seule fois, et voit celles qu'il a aimées

## Installation

Prérequis : [Node.js](https://nodejs.org) 18 ou plus et [PostgreSQL](https://www.postgresql.org/download/).

```bash
npm install          # installe le driver pg
npm run init-db      # crée la base application_image, ses tables et ses données
npm start            # lance le serveur
```

Puis ouvrir <http://localhost:8080>.

Par défaut, le serveur se connecte à PostgreSQL sur `localhost:5432` avec l'utilisateur `postgres` et le mot de passe `postgres`. Si ton mot de passe est différent, définis la variable `PGPASSWORD` avant les commandes :

```bash
# Windows (PowerShell)
$env:PGPASSWORD = "ton_mot_de_passe"

# Linux / macOS
export PGPASSWORD=ton_mot_de_passe
```

Les autres réglages possibles sont `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` et `PORT` (port du serveur web).

`npm run init-db` peut être relancé à tout moment pour remettre la base dans son état de départ.

## Routes

| Méthode | URL | Description |
| --- | --- | --- |
| GET | `/` | Accueil |
| GET | `/images` | Mur d'images |
| GET | `/page-image/<id>` | Page d'une image avec ses commentaires |
| POST | `/image-description` | Ajoute un commentaire, puis redirige vers l'image |
| GET / POST | `/signup` | Formulaire et traitement de l'inscription |
| GET / POST | `/signin` | Formulaire et traitement de la connexion |
| GET | `/logout` | Déconnexion |
| GET | `/like/<id>` | Aime une image (utilisateur connecté) |
| GET | `/public/...` | Fichiers statiques (CSS, JavaScript, images) |

## Base de données

```
auteurs (id, prenom, nom)
orientations (id, nom)
images (id, nom, date, #orientation, fichier, likes, #auteur)
commentaires (id, texte, #id_image, date)
accounts (id, username, salt, hash)
accounts_images_likes (#id_account, #id_image)
```

Les fichiers des photos restent sur le disque (`public/images/`) ; la base ne stocke que leurs informations.

## Sécurité

Le cours présente des versions simplifiées et recommande lui-même de les renforcer. Ce projet applique ces recommandations :

- requêtes SQL **paramétrées** (`$1`, `$2`) contre les injections SQL ;
- mots de passe hachés avec **scrypt** et un sel aléatoire, jamais stockés en clair ;
- identifiant de session **imprévisible** (`crypto.randomUUID`) dans un cookie `HttpOnly` ;
- textes **échappés** avant d'être insérés dans les pages (protection XSS) ;
- accès limité au dossier `public/` (pas de *path traversal*) et taille des formulaires limitée.

Les sessions restent en mémoire : elles sont perdues au redémarrage du serveur.

## Tests

```bash
npm test
```

14 tests de bout en bout lancent le serveur contre une vraie base PostgreSQL (la base est réinitialisée au début) : pages, commentaires, comptes, likes et sécurité. Ils tournent aussi automatiquement sur GitHub Actions à chaque envoi.

## Structure

```
server.js            # serveur HTTP et routage
db.js                # accès à PostgreSQL
auth.js              # sessions et mots de passe
views.js             # génération des pages HTML
public/              # CSS, JavaScript du navigateur, images
sql/                 # schéma et données de la base
scripts/init-db.js   # initialisation de la base
test/                # tests
```

## Auteur

**Alexis Blanchard**
