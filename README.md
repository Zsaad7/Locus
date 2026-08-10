# Locus

// check

**Gestion d'équipe pour station-service, où l'accès est lié au lieu.**

Locus est une application web qui permet aux gérants de piloter leur station et à leurs salariés de pointer, consulter leurs informations et suivre leurs tâches — avec une règle centrale : **un salarié ne peut se connecter que depuis la station**, tandis qu'un responsable accède à l'application de n'importe où. Le produit est pensé pour accueillir plusieurs services au fil du temps sans réécriture.

---

## Sommaire

- [Concept](#concept)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Le verrou d'accès à la station](#le-verrou-daccès-à-la-station)
- [Modèle de données](#modèle-de-données)
- [Les écrans](#les-écrans)
- [Structure du projet](#structure-du-projet)
- [Démarrage](#démarrage)
- [Variables d'environnement](#variables-denvironnement)
- [Roadmap](#roadmap)

---

## Concept

| | |
|---|---|
| **Rôle `responsable`** | Se connecte de partout dans le monde, aucune restriction. |
| **Rôle `salarie`** | Se connecte uniquement lorsqu'il est physiquement à la station (via son WiFi). |
| **Extensibilité** | Chaque nouveau service = un nouveau module, branché sans toucher à l'existant. |

Le nom **Locus** (« lieu » en latin) reflète cette idée : l'accès est ancré à un endroit précis.

---

## Stack technique

- **Frontend** : React + Vite + TypeScript
- **Backend** : NestJS (TypeScript), en monolithe modulaire
- **Base de données** : PostgreSQL (managé — Neon ou Railway)
- **ORM** : Prisma
- **Authentification** : JWT (access + refresh), avec rôles `responsable` / `salarie`
- **Hébergement** : backend sur Railway/Render, frontend sur Vercel/Netlify

Principe directeur : **le frontend ne parle jamais directement à la base de données.** Toute lecture/écriture passe par l'API NestJS, qui est la seule porte d'entrée et applique l'authentification, le contrôle d'accès et la logique métier.

---

## Architecture

Le backend est un **monolithe modulaire** : un seul déploiement, mais découpé en modules indépendants. On ne part pas sur des microservices — c'est prématuré ; NestJS est fait pour cette organisation.

Chaque requête traverse les mêmes couches :

```
Client React  →  Guards (JWT + vérif IP)  →  Controller  →  Service (logique métier)  →  Prisma  →  PostgreSQL
```

Chaque domaine fonctionnel est un **module** avec sa propre paire controller/service :

| Module | Responsabilité |
|---|---|
| `AuthModule` | Login, inscription, JWT, guards, contrôle d'accès par IP |
| `UsersModule` | Profils, rôles, postes (matin / après-midi / nuit) |
| `StationsModule` | Coordonnées, IP publique autorisée |
| `AttendanceModule` | Pointage (entrée / sortie) |
| `WarningsModule` | Avertissements |
| `PointsModule` | Système de points |
| `TasksModule` | Tâches communes et spécifiques, et leurs complétions |
| `CommonModule` | Guards, décorateurs, interceptors et DTOs partagés |

**Ajouter un service demain** = créer un module et l'importer dans `AppModule`. Rien à casser dans l'existant.

---

## Le verrou d'accès à la station

C'est le cœur de Locus. Le contrôle repose sur **l'IP publique de la station**, pas sur l'adresse MAC (impossible à lire depuis un navigateur — elle ne quitte jamais le réseau local).

Tous les appareils sur le WiFi de la station sortent sur internet avec la même IP publique (NAT). Le backend voit cette IP sur chaque requête et applique la règle :

```
sur chaque requête protégée :
  role = lu depuis le JWT
  si role === 'responsable'  → autorisé
  si role === 'salarie' :
      clientIp = IP réelle de la requête
      si clientIp !== station.allowed_ip  → 403
```

La vérification est **rejouée à chaque action** via un guard global, pas seulement au login. Dès qu'un salarié quitte le WiFi de la station (passage en 4G, retour chez lui), sa prochaine action échoue immédiatement.

### Points d'attention

- **`trust proxy` obligatoire.** Derrière Railway/Render, le backend est derrière un load balancer. Il faut activer `trust proxy` et lire l'IP dans l'en-tête `X-Forwarded-For`, sinon toutes les requêtes semblent venir de la même IP (celle du proxy) et le contrôle est cassé silencieusement.
- **L'IP publique peut changer.** Sur une IP dynamique (cas fréquent), elle saute lors d'un redémarrage de box ou d'une coupure. Deux solutions :
  1. Demander une **IP fixe** au fournisseur d'accès (recommandé à terme).
  2. **Auto-mise à jour** : quand le responsable se connecte depuis la station, l'application met à jour `station.allowed_ip` automatiquement — il sert de point de vérité.
- **Le salarié doit être sur le WiFi de la station**, pas sur ses données mobiles.

---

## Modèle de données

| Table | Champs clés |
|---|---|
| `stations` | `id`, `name`, `allowed_ip` |
| `users` | `id`, `full_name`, `role`, `shift`, `points`, `station_id` |
| `attendance` | `id`, `user_id`, `clock_in`, `clock_out` |
| `warnings` | `id`, `user_id`, `reason`, `severity`, `created_at` |
| `tasks` | `id`, `title`, `scope` (`common`/`specific`), `shift`, `station_id` |
| `task_completions` | `id`, `task_id`, `user_id`, `completed_at` |

Le schéma est décrit dans `schema.prisma` et les migrations sont versionnées.

Notes :
- `scope` vaut `common` (tout le monde) ou `specific` ; `shift` (`matin`/`apres_midi`/`nuit`) n'est renseigné que pour les tâches spécifiques.
- `role` vaut `responsable` ou `salarie`.

---

## Les écrans

1. **Login / Inscription** — authentification JWT + contrôle d'accès par IP.
2. **Dashboard** — informations personnelles, pointage, avertissements, points.
3. **Tâches** — deux parties : tâches communes (tout le monde) + tâches spécifiques au poste du salarié.

---

## Structure du projet

```
locus/
├── backend/                  # API NestJS
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── stations/
│   │   │   ├── attendance/
│   │   │   ├── warnings/
│   │   │   ├── points/
│   │   │   └── tasks/
│   │   ├── common/           # guards, décorateurs, interceptors, DTOs partagés
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── package.json
│
└── frontend/                 # Application React + Vite
    ├── src/
    │   ├── pages/            # login, dashboard, tasks
    │   ├── components/
    │   ├── api/              # appels à l'API NestJS
    │   └── main.tsx
    └── package.json
```

---

## Démarrage

### Prérequis

- Node.js 20+
- Une base PostgreSQL accessible (Neon, Railway, ou locale)

### Backend

```bash
cd backend
npm install
cp .env.example .env          # puis renseigner les variables
npx prisma migrate dev        # applique le schéma à la base
npm run start:dev             # démarre l'API en mode watch
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # renseigner VITE_API_URL
npm run dev
```

---

## Variables d'environnement

### `backend/.env`

```
DATABASE_URL="postgresql://user:password@host:5432/locus"
JWT_SECRET="change-me"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="change-me-too"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3000
TRUST_PROXY=true
```

### `frontend/.env`

```
VITE_API_URL="http://localhost:3000"
```

---

## Roadmap

Première tranche à livrer (tranche verticale, pour tester le verrou station au plus vite) :

1. `schema.prisma` réduit : `stations` + `users`.
2. `AuthModule` : login JWT + guard IP.
3. Écran de login React.

Puis, par ordre de priorité :

- [ ] Modules `Attendance`, `Tasks`, `Points`, `Warnings` (CRUD).
- [ ] Panneau admin pour le responsable (création de tâches, avertissements, attribution de points).
- [ ] Auto-mise à jour de l'IP autorisée depuis la session du responsable.
- [ ] Revérification IP sur tous les endpoints (guard global généralisé).
- [ ] Tâches récurrentes (réinitialisation quotidienne) et modèles par poste.
- [ ] Temps réel (notifications d'avertissement, suivi live du pointage côté responsable).
- [ ] Résilience hors ligne (PWA + file d'attente) si la connexion de la station est instable.
- [ ] Nouveaux services métier, ajoutés comme modules indépendants.

---

*Locus — l'accès, ancré au lieu.*
