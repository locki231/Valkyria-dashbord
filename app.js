const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('rate-limiter-flexible');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
const winston = require('winston');

// Configuration du logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: path.join(__dirname, 'logs', 'fivem-monitor.log') })
    ]
});

/**
 * FiveM Server Monitor Pro
 * Système de surveillance professionnel pour serveurs FiveM
 */
class FiveMMonitorServer {
    constructor() {
        this.app = express();
        this.serverData = {
            players: [],
            info: {},
            dynamic: {},
            lastUpdate: null,
            history: [],
            playerSessions: new Map(), // Stocker les sessions des joueurs
            uniquePlayersEverConnected: new Set(), // Set pour stocker les joueurs uniques
            stats: {
                peakToday: 0,
                totalConnections: 0,
                uptime: new Date()
            }
        };
        this.fivemServer = '136.243.177.111:30085';
        this.maxPlayers = 48;
        this.init();
    }

    /**
     * Initialisation du serveur
     */
    init() {
        this.setupMiddleware();
        this.setupRoutes();
        this.startDataCollection();
        logger.info('🚀 FiveM Monitor Pro initialisé');
    }

    /**
     * Configuration des middlewares de sécurité et performance
     */
    setupMiddleware() {
        // Sécurité avec Helmet
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    scriptSrcAttr: ["'unsafe-inline'"], // Permettre les event handlers inline
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
                }
            }
        }));

        // Performance et CORS
        this.app.use(compression());
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));

        // Rate limiting
        const rateLimiter = new rateLimit.RateLimiterMemory({
            keyGenerator: (req) => req.ip,
            points: 100,
            duration: 60,
        });

        this.app.use(async (req, res, next) => {
            try {
                await rateLimiter.consume(req.ip);
                next();
            } catch (rejRes) {
                res.status(429).json({ 
                    success: false, 
                    error: 'Trop de requêtes, veuillez patienter' 
                });
            }
        });

        logger.info('✅ Middleware configuré');
    }

    /**
     * Configuration des routes API
     */
    setupRoutes() {
        // Route principale - Interface web
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // API - Informations complètes du serveur
        this.app.get('/api/server-info', (req, res) => {
            try {
                const isOnline = this.serverData.lastUpdate && 
                    (Date.now() - this.serverData.lastUpdate) < 120000; // 2 minutes

                res.json({
                    success: true,
                    data: {
                        server: {
                            address: this.fivemServer,
                            online: isOnline,
                            maxPlayers: this.maxPlayers,
                            lastUpdate: this.serverData.lastUpdate
                        },
                        info: this.serverData.info,
                        players: {
                            current: this.serverData.players,
                            count: this.serverData.players.length,
                            peak: this.serverData.stats.peakToday
                        },
                        dynamic: this.serverData.dynamic,
                        history: this.serverData.history.slice(-48), // 48h
                        stats: this.serverData.stats
                    }
                });
            } catch (error) {
                logger.error('Erreur API server-info:', error.message);
                res.status(500).json({ 
                    success: false, 
                    error: 'Erreur interne du serveur' 
                });
            }
        });

        // API - Liste des joueurs
        this.app.get('/api/players', (req, res) => {
            try {
                res.json({
                    success: true,
                    data: {
                        players: this.serverData.players,
                        count: this.serverData.players.length,
                        maxPlayers: this.maxPlayers,
                        lastUpdate: this.serverData.lastUpdate
                    }
                });
            } catch (error) {
                logger.error('Erreur API players:', error.message);
                res.status(500).json({ success: false, error: 'Erreur serveur' });
            }
        });

        // API - Recherche de joueurs
        this.app.get('/api/search/:query', (req, res) => {
            try {
                const query = req.params.query.toLowerCase().trim();
                
                if (!query || query.length < 2) {
                    return res.json({
                        success: false,
                        error: 'La recherche doit contenir au moins 2 caractères'
                    });
                }

                const filteredPlayers = this.serverData.players.filter(player => 
                    player.name.toLowerCase().includes(query) || 
                    player.id.toString().includes(query)
                );

                res.json({
                    success: true,
                    data: {
                        query: query,
                        results: filteredPlayers,
                        count: filteredPlayers.length,
                        total: this.serverData.players.length
                    }
                });
            } catch (error) {
                logger.error('Erreur API search:', error.message);
                res.status(500).json({ success: false, error: 'Erreur de recherche' });
            }
        });

        // API - Statut du serveur
        this.app.get('/api/status', (req, res) => {
            try {
                const isOnline = this.serverData.lastUpdate && 
                    (Date.now() - this.serverData.lastUpdate) < 120000;

                const uptime = Math.floor((Date.now() - this.serverData.stats.uptime.getTime()) / 1000);

                res.json({
                    success: true,
                    data: {
                        online: isOnline,
                        serverAddress: this.fivemServer,
                        players: this.serverData.players.length,
                        maxPlayers: this.maxPlayers,
                        lastUpdate: this.serverData.lastUpdate,
                        uptime: uptime,
                        version: '2.0.0'
                    }
                });
            } catch (error) {
                logger.error('Erreur API status:', error.message);
                res.status(500).json({ success: false, error: 'Erreur serveur' });
            }
        });

        // API - Historique des joueurs avec plages temporelles glissantes
        this.app.get('/api/history', (req, res) => {
            try {
                const period = req.query.period || '24h';
                const now = new Date();
                let cutoffTime;
                let responseHistory = [];

                // Déterminer la plage temporelle glissante
                switch (period) {
                    case '24h':
                        cutoffTime = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Dernières 24h
                        break;
                    case '7d':
                        cutoffTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 derniers jours
                        break;
                    case '30d':
                        cutoffTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 derniers jours
                        break;
                    default:
                        cutoffTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                }

                // Filtrer les données historiques réelles selon la plage temporelle
                responseHistory = this.serverData.history.filter(entry => {
                    const entryTime = new Date(entry.timestamp);
                    return entryTime >= cutoffTime;
                });

                // Si nous n'avons pas assez de données historiques, compléter avec les données actuelles
                if (responseHistory.length === 0) {
                    const currentPlayerCount = this.serverData.players.length;
                    
                    // Créer quelques points de données de base pour commencer
                    switch (period) {
                        case '24h':
                            // Créer un point toutes les heures pour les 24 dernières heures
                            for (let i = 23; i >= 0; i--) {
                                const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
                                responseHistory.push({
                                    timestamp: timestamp.toISOString(),
                                    playerCount: currentPlayerCount,
                                    period: '24h'
                                });
                            }
                            break;
                        
                        case '7d':
                            // Créer un point par jour pour les 7 derniers jours
                            for (let i = 6; i >= 0; i--) {
                                const timestamp = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
                                responseHistory.push({
                                    timestamp: timestamp.toISOString(),
                                    playerCount: currentPlayerCount,
                                    period: '7d'
                                });
                            }
                            break;
                        
                        case '30d':
                            // Créer un point par jour pour les 30 derniers jours
                            for (let i = 29; i >= 0; i--) {
                                const timestamp = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
                                responseHistory.push({
                                    timestamp: timestamp.toISOString(),
                                    playerCount: currentPlayerCount,
                                    period: '30d'
                                });
                            }
                            break;
                    }
                }

                // Trier par timestamp croissant
                responseHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                res.json({
                    success: true,
                    data: {
                        history: responseHistory,
                        period: period,
                        timeRange: {
                            from: cutoffTime.toISOString(),
                            to: now.toISOString()
                        },
                        totalPoints: responseHistory.length,
                        isRealData: this.serverData.history.length > 0 && responseHistory.length > 0
                    }
                });

                logger.info(`📊 Données historiques envoyées: ${responseHistory.length} points pour ${period} (${cutoffTime.toLocaleString()} à ${now.toLocaleString()})`);
                
            } catch (error) {
                logger.error('Erreur API history:', error.message);
                res.status(500).json({ 
                    success: false, 
                    error: 'Erreur interne du serveur' 
                });
            }
        });

        // API - Test de fonctionnement
        this.app.get('/api/test', (req, res) => {
            res.json({
                success: true,
                message: 'FiveM Monitor Pro API opérationnelle',
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                endpoints: [
                    '/api/server-info',
                    '/api/players', 
                    '/api/search/:query',
                    '/api/status'
                ]
            });
        });

        // Gestion des erreurs 404
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint non trouvé',
                availableEndpoints: ['/api/server-info', '/api/players', '/api/search/:query', '/api/status', '/api/test']
            });
        });

        logger.info('✅ Routes API configurées');
    }

    /**
     * Récupération des données FiveM
     */
    async fetchFiveMData() {
        try {
            const timeout = 8000; // 8 secondes
            const [playersRes, infoRes, dynamicRes] = await Promise.allSettled([
                axios.get(`http://${this.fivemServer}/players.json`, { timeout }),
                axios.get(`http://${this.fivemServer}/info.json`, { timeout }),
                axios.get(`http://${this.fivemServer}/dynamic.json`, { timeout })
            ]);

            let hasData = false;

            // Traitement des joueurs
            if (playersRes.status === 'fulfilled' && playersRes.value.data) {
                const currentTime = Date.now();
                const currentPlayerIds = new Set();
                
                this.serverData.players = playersRes.value.data.map((player, index) => {
                    const playerId = player.id || index + 1;
                    const playerIdentifier = player.identifiers?.[0] || `player_${playerId}`;
                    currentPlayerIds.add(playerId);
                    
                    // Ajouter le joueur au set des joueurs uniques
                    this.serverData.uniquePlayersEverConnected.add(playerIdentifier);
                    
                    // Si c'est un nouveau joueur, enregistrer son heure de connexion
                    if (!this.serverData.playerSessions.has(playerId)) {
                        this.serverData.playerSessions.set(playerId, {
                            joinTime: currentTime,
                            totalTime: 0
                        });
                    }
                    
                    // Calculer la durée de session actuelle
                    const session = this.serverData.playerSessions.get(playerId);
                    const sessionDuration = Math.floor((currentTime - session.joinTime) / 1000 / 60); // en minutes
                    
                    return {
                        id: playerId,
                        name: player.name || `Joueur ${index + 1}`,
                        ping: player.ping || 0,
                        identifiers: player.identifiers || [],
                        endpoint: player.endpoint || 'Inconnu',
                        sessionDuration: sessionDuration,
                        totalTime: session.totalTime + sessionDuration
                    };
                });
                
                // Nettoyer les sessions des joueurs déconnectés
                for (const [playerId, session] of this.serverData.playerSessions.entries()) {
                    if (!currentPlayerIds.has(playerId)) {
                        // Ajouter le temps de session au temps total avant de supprimer
                        const sessionTime = Math.floor((currentTime - session.joinTime) / 1000 / 60);
                        session.totalTime += sessionTime;
                        // On garde les données pour les statistiques mais on met à jour joinTime
                        session.joinTime = currentTime;
                    }
                }
                
                hasData = true;
            }

            // Traitement des informations serveur
            if (infoRes.status === 'fulfilled' && infoRes.value.data) {
                this.serverData.info = {
                    hostname: infoRes.value.data.vars?.sv_projectName || 
                             infoRes.value.data.vars?.sv_hostname || 
                             'Serveur FiveM',
                    version: infoRes.value.data.version || 'Inconnue',
                    description: infoRes.value.data.vars?.sv_projectDesc || '',
                    maxClients: infoRes.value.data.vars?.sv_maxClients || '48',
                    resources: infoRes.value.data.resources || [],
                    ...infoRes.value.data
                };
                hasData = true;
            }

            // Traitement des données dynamiques
            if (dynamicRes.status === 'fulfilled' && dynamicRes.value.data) {
                this.serverData.dynamic = dynamicRes.value.data;
                hasData = true;
            }

            if (hasData) {
                this.serverData.lastUpdate = Date.now();
                this.updateStats();
                this.updateHistory();
                
                logger.info(`✅ Données mises à jour - ${this.serverData.players.length}/${this.maxPlayers} joueurs`);
            } else {
                logger.warn('⚠️ Aucune donnée récupérée du serveur FiveM');
            }

        } catch (error) {
            logger.error(`❌ Erreur lors de la récupération des données: ${error.message}`);
        }
    }

    /**
     * Mise à jour des statistiques
     */
    updateStats() {
        const currentCount = this.serverData.players.length;
        
        // Mise à jour du pic du jour
        if (currentCount > this.serverData.stats.peakToday) {
            this.serverData.stats.peakToday = currentCount;
        }

        // Mise à jour du total de connexions uniques
        this.serverData.stats.totalConnections = this.serverData.uniquePlayersEverConnected.size;
    }

    /**
     * Mise à jour de l'historique avec gestion des plages temporelles
     */
    updateHistory() {
        const now = new Date();
        const currentCount = this.serverData.players.length;
        
        // Ajouter le nouveau point de données
        this.serverData.history.push({
            timestamp: now.toISOString(),
            playerCount: currentCount,
            hour: now.getHours(),
            minute: now.getMinutes(),
            period: '30s' // Fréquence de collecte
        });

        // Nettoyer l'historique ancien pour optimiser la mémoire
        // Garder 30 jours de données (30 jours * 24h * 120 points/heure = 86400 points max)
        const maxHistoryPoints = 86400; // 30 jours à 30 secondes d'intervalle
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        // Filtrer les données plus anciennes que 30 jours
        this.serverData.history = this.serverData.history.filter(entry => {
            return new Date(entry.timestamp) >= thirtyDaysAgo;
        });

        // Si on dépasse encore la limite, garder seulement les plus récents
        if (this.serverData.history.length > maxHistoryPoints) {
            this.serverData.history = this.serverData.history.slice(-maxHistoryPoints);
        }

        // Log périodique pour le débogage (toutes les 5 minutes)
        if (now.getMinutes() % 5 === 0 && now.getSeconds() < 30) {
            logger.info(`📊 Historique: ${this.serverData.history.length} points stockés (${currentCount} joueurs actuels)`);
        }
    }

    /**
     * Génération de données historiques simulées pour les tests
     */
    generateSimulatedHistory() {
        const now = new Date();
        this.serverData.history = [];
        
        // Ne pas simuler de joueurs uniques fictifs
        // Les joueurs uniques seront ajoutés via les vraies connexions
        
        // Initialiser avec quelques points de données réels récents
        const realDataPoints = Math.min(10, 24); // Limiter à 24 points max
        for (let i = realDataPoints; i >= 0; i--) {
            const timestamp = new Date(now.getTime() - (i * 30 * 60 * 1000)); // Toutes les 30 minutes
            
            // Utiliser 0 ou le nombre actuel de joueurs pour l'historique initial
            const currentPlayerCount = this.serverData.players ? this.serverData.players.length : 0;
            
            this.serverData.history.push({
                timestamp: timestamp.toISOString(),
                playerCount: currentPlayerCount,
                hour: timestamp.getHours(),
                minute: timestamp.getMinutes()
            });
        }
        
        logger.info(`📊 ${this.serverData.history.length} points de données réelles initialisés`);
        logger.info(`👥 ${this.serverData.uniquePlayersEverConnected.size} joueurs uniques réels`);
    }

    /**
     * Démarrage de la collecte de données
     */
    startDataCollection() {
        // Initialiser l'historique vide pour collecter les vraies données
        this.serverData.history = [];
        
        // Récupération initiale
        this.fetchFiveMData();

        // Mise à jour toutes les 30 secondes
        cron.schedule('*/30 * * * * *', () => {
            this.fetchFiveMData();
        });

        // Nettoyage des statistiques quotidiennes à minuit
        cron.schedule('0 0 * * *', () => {
            this.serverData.stats.peakToday = this.serverData.players.length;
            logger.info('📊 Statistiques quotidiennes remises à zéro');
        });

        logger.info('📊 Collecte de données démarrée (30s)');
    }

    /**
     * Démarrage du serveur
     */
    start() {
        const PORT = process.env.PORT || 3000;
        
        this.server = this.app.listen(PORT, () => {
            logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
            console.log(`
╔══════════════════════════════════════════════════╗
║              FiveM Monitor Pro v2.0              ║
║                                                  ║
║  🌐 Interface Web: http://localhost:${PORT}        ║
║  📡 API REST:      http://localhost:${PORT}/api   ║
║  🎯 Serveur FiveM: ${this.fivemServer}         ║
║  👥 Slots Max:     ${this.maxPlayers} joueurs                     ║
║                                                  ║
║  Status: ✅ Opérationnel                        ║
╚══════════════════════════════════════════════════╝
            `);
        });

        // Gestion propre de l'arrêt
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
        process.on('SIGUSR2', () => this.gracefulShutdown()); // nodemon
    }

    /**
     * Arrêt propre du serveur
     */
    gracefulShutdown() {
        logger.info('🛑 Arrêt du serveur en cours...');
        
        if (this.server) {
            this.server.close(() => {
                logger.info('✅ Serveur arrêté proprement');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    }
}

// Démarrage du serveur
if (require.main === module) {
    const monitor = new FiveMMonitorServer();
    monitor.start();
}

module.exports = FiveMMonitorServer;
