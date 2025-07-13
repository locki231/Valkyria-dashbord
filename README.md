# 🎮 FiveM Server Monitor

Une application de monitoring en temps réel pour serveur FiveM avec interface web moderne et analytics avancés sur **plages temporelles glissantes**.

![FiveM Monitor Dashboard](https://via.placeholder.com/800x400/667eea/ffffff?text=Dashboard+FiveM+Monitor)

## 🌐 Démo en Ligne

**[➡️ Accéder à l'application](https://locki-design.github.io/fivem-server-monitor/)**

> 📊 **Nouveauté** : Graphiques avec plages temporelles dynamiques (24h, 7j, 30j derniers)

## 📊 Fonctionnalités

- **Monitoring en temps réel** du serveur FiveM
- **Suivi des joueurs** connectés et historique
- **Connexions uniques** avec compteur de joueurs différents
- **Graphiques interactifs** avec Chart.js :
  - **24h** : Activité des dernières 24 heures
  - **7j** : Tendances des 7 derniers jours
  - **30j** : Statistiques des 30 derniers jours
- **Interface responsive** et moderne
- **Recherche de joueurs** avancée
- **Classement** des joueurs les plus connectés
- **Données en temps réel** via API FiveM

## 🚀 Technologies

- **Backend**: Node.js + Express
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Visualisation**: Chart.js 3.9.1
- **Sécurité**: Helmet CSP, CORS
- **API**: FiveM Server API

## 📋 Informations Serveur

- **IP**: 136.243.177.111:30085
- **Mise à jour**: Automatique toutes les 30 secondes
- **Sécurité**: CSP compliant, événements délégués

## 🛠️ Installation Locale

```bash
# Cloner le repository
git clone https://github.com/votre-username/fivem-server-monitor.git

# Installer les dépendances
npm install

# Démarrer le serveur
npm start
```

## 📱 Interface

L'application propose :
- Dashboard avec statistiques en temps réel
- **Graphiques de performance** avec plages temporelles :
  - Vue **24h** : Données des dernières 24 heures glissantes
  - Vue **7j** : Analyse des 7 derniers jours
  - Vue **30j** : Historique des 30 derniers jours
- Liste des joueurs actifs
- Historique des connexions
- Système de recherche
- Interface responsive mobile/desktop

## 🔧 Configuration

Le serveur peut être configuré via les variables d'environnement :
- `PORT`: Port du serveur (défaut: 3000)
- `FIVEM_SERVER_IP`: IP du serveur FiveM à monitorer

## 📈 Statistiques Suivies

- **Nombre de joueurs connectés** (temps réel)
- **Pic de joueurs** sur les périodes sélectionnées
- **Total des connexions uniques** (joueurs différents)
- **Temps de connexion** des joueurs
- **Activité du serveur** avec historique glissant :
  - Dernières 24 heures (mise à jour continue)
  - 7 derniers jours (tendances hebdomadaires)
  - 30 derniers jours (analyse mensuelle)

---

*Développé pour le monitoring professionnel de serveurs FiveM*