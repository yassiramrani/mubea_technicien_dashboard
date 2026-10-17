Objet : Déploiement de l'application d'inventaire de l'outillage sur un serveur interne — besoins

Bonjour,

Je souhaite installer l'application « Mubea Maintenance Inventory » (inventaire de l'outillage, étiquettes et scan par QR code) sur un serveur interne de l'entreprise. Elle fonctionne aujourd'hui sur Vercel avec une base Supabase, hors du réseau. Voici ce dont l'installation a besoin :

1. Un serveur Windows (Windows Server ou PC de l'atelier) allumé en permanence, avec un nom ou une adresse IP fixe.
2. Node.js 22.18+ LTS (ou 24 LTS) — environ 500 Mo de RAM et 2 Go de disque.
3. Une base PostgreSQL 14 ou plus récent (instance existante ou installation locale), avec une base vide et un utilisateur dédié.
4. Un nom intranet (par exemple technicien.mubea.local) et un certificat TLS de l'autorité interne Mubea. Le HTTPS est obligatoire : le cookie de session est sécurisé et le scanner a besoin de la caméra.
5. IIS avec ARR + URL Rewrite pour publier le certificat sur le port 443 et rediriger vers l'application, qui n'écoute que sur 127.0.0.1:3000.
6. L'autorisation d'installer l'application comme service Windows (démarrage automatique avec la machine).
7. Une règle pare-feu autorisant le port 443 depuis le réseau de l'atelier uniquement.
8. Un emplacement de sauvegarde (partage réseau) pour un dump quotidien de la base.

Deux points à trancher :
- Un accès ponctuel au registre npm est-il autorisé, ou faut-il préparer le déploiement ailleurs puis copier le dossier ?
- Un passage à Entra ID / SSO est-il prévu plus tard ? (Aujourd'hui : codes d'accès personnels par technicien.)

La reprise des données actuelles (11 Mo) se fera par un dump/restore, dans une fenêtre courte en fin de poste. Aucun accès Internet n'est nécessaire après installation et aucun coût de licence supplémentaire n'est requis.

Je reste à votre disposition pour en discuter.

Cordialement,
Yassir AMRANI
