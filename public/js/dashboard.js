/**
 * FiveM Dashboard Pro - Interface moderne de monitoring
 * Gestion complète des données temps réel avec API REST
 */

class FiveMDashboard {
    constructor() {
        this.config = {
            apiBaseUrl: '/api',
            updateInterval: 30000, // 30 secondes
            retryDelay: 5000, // 5 secondes en cas d'erreur
            maxRetries: 3
        };
        
        this.state = {
            serverData: null,
            players: [],
            isOnline: false,
            lastUpdate: null,
            currentRetries: 0,
            searchResults: []
        };
        
        this.elements = {};
        this.updateTimer = null;
        
        this.init();
    }

    /**
     * Initialisation du dashboard
     */
    async init() {
        console.log('🚀 FiveM Dashboard Pro - Initialisation...');
        
        try {
            this.cacheElements();
            this.bindEvents();
            this.setupAPITester();
            this.initChart();
            await this.loadInitialData();
            this.startAutoUpdate();
            
            console.log('✅ Dashboard initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            this.showError('Erreur d\'initialisation', error.message);
        }
    }

    /**
     * Cache des éléments DOM pour de meilleures performances
     */
    cacheElements() {
        this.elements = {
            // Header et serveur
            serverName: document.getElementById('serverName'),
            serverAddress: document.getElementById('serverAddress'),
            statusBadge: document.getElementById('statusBadge'),
            
            // Statistiques
            serverStatus: document.getElementById('serverStatus'),
            currentPlayers: document.getElementById('currentPlayers'),
            maxPlayers: document.getElementById('maxPlayers'),
            peakToday: document.getElementById('peakToday'),
            totalConnections: document.getElementById('totalConnections'),
            uptime: document.getElementById('uptime'),
            
            // Recherche
            playerSearch: document.getElementById('playerSearch'),
            
            // Tableaux
            playersTable: document.getElementById('playersTable'),
            
            // Graphique
            playersChart: document.getElementById('playersChart'),
            timeButtons: document.querySelectorAll('.time-btn'),
            
            // API Tester
            apiEndpoint: document.getElementById('api-endpoint'),
            testButton: document.getElementById('test-button'),
            apiResponse: document.getElementById('api-response'),
            
            // Messages et mise à jour
            lastUpdate: document.getElementById('lastUpdate')
        };
        
        // Vérifier que tous les éléments essentiels sont présents
        const required = ['serverStatus', 'currentPlayers', 'playersTable'];
        const missing = required.filter(key => !this.elements[key]);
        
        if (missing.length > 0) {
            console.warn(`Éléments DOM manquants: ${missing.join(', ')}`);
        }
    }

    /**
     * Liaison des événements
     */
    bindEvents() {
        // Recherche de joueurs
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
            this.elements.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleSearch();
                }
            });
        }
        
        if (this.elements.searchButton) {
            this.elements.searchButton.addEventListener('click', this.handleSearch.bind(this));
        }
        
        // Test API
        if (this.elements.testButton) {
            this.elements.testButton.addEventListener('click', this.testAPI.bind(this));
        }
        
        // Bouton de rafraîchissement
        const refreshButton = document.getElementById('refreshButton');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                window.location.reload();
            });
        }
        
        // Gestion du modal - fermeture
        const closeModalBtn = document.getElementById('closeModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', this.closePlayerModal.bind(this));
        }
        
        const closeModalFooterBtn = document.getElementById('closeModalFooterBtn');
        if (closeModalFooterBtn) {
            closeModalFooterBtn.addEventListener('click', this.closePlayerModal.bind(this));
        }
        
        // Action kick player
        const kickPlayerBtn = document.getElementById('kickPlayerBtn');
        if (kickPlayerBtn) {
            kickPlayerBtn.addEventListener('click', this.kickPlayer.bind(this));
        }
        
        // Event delegation pour les boutons générés dynamiquement
        document.addEventListener('click', (e) => {
            // Fermeture modal
            if (e.target.hasAttribute('data-modal') && e.target.getAttribute('data-modal') === 'close') {
                this.closePlayerModal();
            }
            
            // Action kick
            if (e.target.hasAttribute('data-action') && e.target.getAttribute('data-action') === 'kick') {
                this.kickPlayer();
            }
            
            // Fermeture notifications d'erreur
            if (e.target.classList.contains('error-close-btn')) {
                const notification = e.target.closest('.error-notification');
                if (notification) {
                    notification.remove();
                }
            }
            
            // Bouton reload
            if (e.target.classList.contains('reload-btn')) {
                location.reload();
            }
            
            // Fermeture modal en cliquant à l'extérieur
            if (e.target.classList.contains('player-modal')) {
                this.closePlayerModal();
            }
        });
        
        // Boutons de filtres temporels avec plages glissantes
        if (this.elements.timeButtons) {
            this.elements.timeButtons.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    // Retirer la classe active de tous les boutons
                    this.elements.timeButtons.forEach(b => b.classList.remove('active'));
                    // Ajouter la classe active au bouton cliqué
                    e.target.classList.add('active');
                    
                    // Récupérer la période depuis l'attribut data-period ou le texte
                    const period = e.target.getAttribute('data-period') || 
                                   (e.target.textContent.includes('7j') ? '7d' : 
                                    e.target.textContent.includes('30') ? '30d' : '24h');
                    
                    const periodLabels = {
                        '24h': 'Dernières 24 heures',
                        '7d': '7 derniers jours', 
                        '30d': '30 derniers jours'
                    };
                    
                    console.log(`📊 Filtre temporel changé: ${periodLabels[period]} (${period}) - Plage glissante`);
                    
                    // Recharger le graphique avec la nouvelle période glissante
                    await this.reloadChart(period);
                });
            });
        }
        
        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.refreshData();
            }
            if (e.key === 'F5') {
                e.preventDefault();
                this.refreshData();
            }
        });
        
        // Gestion de la visibilité de la page
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.refreshData();
            }
        });
    }

    /**
     * Configuration du testeur d'API
     */
    setupAPITester() {
        if (!this.elements.apiEndpoint) return;
        
        const endpoints = [
            '/api/server-info',
            '/api/players',
            '/api/history',
            '/api/search/test',
            '/api/status',
            '/api/test'
        ];
        
        // Créer les options du select
        endpoints.forEach(endpoint => {
            const option = document.createElement('option');
            option.value = endpoint;
            option.textContent = endpoint;
            this.elements.apiEndpoint.appendChild(option);
        });
    }

    /**
     * Chargement des données initiales
     */
    async loadInitialData() {
        this.showLoading(true);
        
        try {
            await Promise.all([
                this.updateServerInfo(),
                this.updatePlayersData(),
                this.updateTopPlayers()
            ]);
            
            // Charger les données historiques pour le graphique
            await this.reloadChart('24h');
            
            this.state.currentRetries = 0;
        } catch (error) {
            console.error('Erreur lors du chargement initial:', error);
            this.handleError(error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Mise à jour des informations du serveur
     */
    async updateServerInfo() {
        try {
            const response = await this.apiCall('/server-info');
            
            if (response.success && response.data) {
                console.log('📊 Données serveur reçues:', response.data);
                this.state.serverData = response.data;
                this.state.isOnline = response.data.server?.online || false;
                this.updateServerDisplay();
                this.updateServerHeader();
                this.updateStatistics();
            }
        } catch (error) {
            console.error('Erreur updateServerInfo:', error);
            this.state.isOnline = false;
            this.updateServerDisplay();
        }
    }

    /**
     * Mise à jour du header avec nom et adresse du serveur
     */
    updateServerHeader() {
        const data = this.state.serverData;
        console.log('🔍 updateServerHeader appelé - Données:', data);
        
        if (!data) {
            console.log('❌ Pas de données serveur');
            return;
        }

        // Test direct sur l'élément
        const serverNameEl = document.getElementById('serverName');
        const serverAddressEl = document.getElementById('serverAddress');
        
        console.log('🔍 Éléments trouvés:', {
            serverName: !!serverNameEl,
            serverAddress: !!serverAddressEl,
            hostname: data.info?.hostname,
            address: data.server?.address
        });

        // Nom du serveur
        if (serverNameEl && data.info?.hostname) {
            console.log('✅ Mise à jour nom serveur:', data.info.hostname);
            serverNameEl.textContent = data.info.hostname;
        }

        // Adresse du serveur
        if (serverAddressEl && data.server?.address) {
            console.log('✅ Mise à jour adresse serveur:', data.server.address);
            serverAddressEl.textContent = data.server.address;
        }
    }

    /**
     * Mise à jour des données des joueurs
     */
    async updatePlayersData() {
        try {
            const response = await this.apiCall('/players');
            
            if (response.success && response.data) {
                this.state.players = response.data.players || [];
                this.updatePlayersTable();
            }
        } catch (error) {
            console.error('Erreur updatePlayersData:', error);
            this.state.players = [];
            this.updatePlayersTable();
        }
    }

    /**
     * Mise à jour de l'activité
     */
    async updateActivity() {
        try {
            const response = await this.apiCall('/activity');
            
            if (response.success && response.data) {
                this.updateActivityTable(response.data.activities || []);
            }
        } catch (error) {
            console.error('Erreur updateActivity:', error);
            this.updateActivityTable([]);
        }
    }

    /**
     * Mise à jour de l'affichage du statut serveur
     */
    updateServerDisplay() {
        if (!this.elements.serverStatus) return;
        
        const isOnline = this.state.isOnline;
        const statusText = isOnline ? 'En ligne' : 'Hors ligne';
        const statusClass = isOnline ? 'status-online' : 'status-offline';
        
        this.elements.serverStatus.textContent = statusText;
        this.elements.serverStatus.className = `server-status ${statusClass}`;
        
        if (this.elements.statusBadge) {
            this.elements.statusBadge.className = `status-badge ${statusClass}`;
            this.elements.statusBadge.textContent = isOnline ? '●' : '●';
        }
        
        // Mettre à jour l'icône dans le titre
        document.title = `${isOnline ? '🟢' : '🔴'} FiveM Monitor Pro`;
    }

    /**
     * Mise à jour des statistiques
     */
    updateStatistics() {
        const data = this.state.serverData;
        if (!data) return;
        
        const currentPlayers = data.players?.count || 0;
        
        // Nombre de joueurs actuels
        if (this.elements.currentPlayers) {
            this.animateNumber(this.elements.currentPlayers, currentPlayers);
        }
        
        // Mettre à jour le graphique avec les données actuelles
        this.updateChart(currentPlayers);
        
        // Maximum de joueurs
        if (this.elements.maxPlayers) {
            this.elements.maxPlayers.textContent = data.server?.maxPlayers || 48;
        }
        
        // Pic du jour
        if (this.elements.peakToday) {
            this.animateNumber(this.elements.peakToday, data.players?.peak || 0);
        }
        
        // Total des connexions
        if (this.elements.totalConnections) {
            this.animateNumber(this.elements.totalConnections, data.stats?.totalConnections || 0);
        }
        
        // Uptime du serveur
        if (this.elements.uptime && data.server?.lastUpdate) {
            const uptime = this.calculateUptime(data.stats?.uptime);
            this.elements.uptime.textContent = uptime;
        }
    }

    /**
     * Animation des nombres
     */
    animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const increment = targetValue > currentValue ? 1 : -1;
        const steps = Math.abs(targetValue - currentValue);
        
        if (steps === 0) return;
        
        let current = currentValue;
        const stepTime = Math.min(50, Math.max(10, 300 / steps));
        
        const timer = setInterval(() => {
            current += increment;
            element.textContent = current;
            
            if (current === targetValue) {
                clearInterval(timer);
            }
        }, stepTime);
    }

    /**
     * Mise à jour du tableau des joueurs
     */
    updatePlayersTable() {
        console.log('🔍 updatePlayersTable - state.players:', this.state.players);
        
        if (!this.elements.playersTable) {
            console.log('❌ Élément playersTable introuvable');
            return;
        }

        // Chercher le conteneur des joueurs
        const tableBody = this.elements.playersTable;
        
        if (!tableBody) {
            console.log('❌ TableBody introuvable');
            return;
        }

        // Récupérer les joueurs depuis le state
        const players = this.state.players || [];
        console.log('👥 Joueurs à afficher:', players);

        // Vider le contenu actuel
        tableBody.innerHTML = '';
        
        if (players.length === 0) {
            tableBody.innerHTML = `
                <div class="table-row no-players">
                    <div class="cell" style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #64748b;">
                        ${this.state.isOnline ? 'Aucun joueur connecté' : 'Serveur hors ligne'}
                    </div>
                </div>
            `;
            return;
        }
        
        players.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'table-row';
            row.style.cursor = 'pointer';
            row.dataset.playerIndex = index;
            
            // Ajouter l'événement de clic pour ouvrir le modal
            row.addEventListener('click', () => {
                console.log('🖱️ Clic sur joueur:', player);
                if (window.fivemDashboard) {
                    window.fivemDashboard.openPlayerModal(player);
                } else {
                    console.log('❌ fivemDashboard non trouvé');
                }
            });
            
            row.innerHTML = `
                <div class="player-cell">
                    <i class="fas fa-user player-avatar"></i>
                    <span class="player-name">${player.name || 'Joueur inconnu'}</span>
                    <small class="player-identifiers">${this.getMainIdentifier(player)}</small>
                </div>
                <div class="cell">${player.id || '-'}</div>
                <div class="cell ${this.getPingClass(player.ping || 0)}">${player.ping || 0}ms</div>
                <div class="cell">${this.formatDuration(player.sessionDuration || 0)}</div>
                <div class="cell">${this.formatDuration(player.totalTime || 0)}</div>
                <div class="cell">
                    <button class="action-btn" data-action="stats">
                        <i class="fas fa-chart-bar"></i>
                        Statistiques
                    </button>
                </div>
            `;
            
            tableBody.appendChild(row);
            
            // Animation d'apparition
            row.style.opacity = '0';
            row.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                row.style.transition = 'all 0.3s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }

    /**
     * Mise à jour du tableau d'activité
     */
    updateActivityTable(activities) {
        if (!this.elements.activityTable) return;
        
        const tbody = this.elements.activityTable.querySelector('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (activities.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 3;
            cell.className = 'no-data';
            cell.textContent = 'Aucune activité récente';
            return;
        }
        
        activities.slice(0, 10).forEach(activity => {
            const row = tbody.insertRow();
            row.className = 'activity-row';
            
            // Type
            const typeCell = row.insertCell();
            const typeIcon = activity.type === 'join' ? '📥' : '📤';
            const typeText = activity.type === 'join' ? 'Connexion' : 'Déconnexion';
            typeCell.innerHTML = `${typeIcon} ${typeText}`;
            typeCell.className = `activity-type ${activity.type}`;
            
            // Nombre de joueurs
            const countCell = row.insertCell();
            countCell.textContent = `${activity.currentCount} joueurs`;
            countCell.className = 'activity-count';
            
            // Timestamp
            const timeCell = row.insertCell();
            timeCell.textContent = this.formatRelativeTime(activity.timestamp);
            timeCell.className = 'activity-time';
        });
    }

    /**
     * Gestion de la recherche de joueurs
     */
    async handleSearch() {
        const query = this.elements.searchInput?.value?.trim();
        
        if (!query || query.length < 2) {
            this.clearSearchResults();
            return;
        }
        
        try {
            this.showSearchLoading(true);
            
            const response = await this.apiCall(`/players/search/${encodeURIComponent(query)}`);
            
            if (response.success) {
                this.displaySearchResults(response.data);
            } else {
                this.showSearchError(response.error || 'Erreur de recherche');
            }
        } catch (error) {
            console.error('Erreur de recherche:', error);
            this.showSearchError('Erreur de connexion');
        } finally {
            this.showSearchLoading(false);
        }
    }

    /**
     * Affichage des résultats de recherche
     */
    displaySearchResults(data) {
        if (!this.elements.searchResults) return;
        
        const container = this.elements.searchResults;
        container.innerHTML = '';
        
        if (data.found === 0) {
            container.innerHTML = `
                <div class="search-no-results">
                    <p>Aucun joueur trouvé pour "${data.searchTerm}"</p>
                </div>
            `;
            return;
        }
        
        const resultsHtml = `
            <div class="search-results-header">
                <h4>${data.found} joueur(s) trouvé(s) pour "${data.searchTerm}"</h4>
            </div>
            <div class="search-results-list">
                ${data.players.map(player => `
                    <div class="search-result-item" data-player-id="${player.id}">
                        <div class="player-info">
                            <span class="player-name">${player.name}</span>
                            <span class="player-id">ID: ${player.id}</span>
                        </div>
                        <div class="player-stats">
                            <span class="player-ping ${this.getPingClass(player.ping || 0)}">
                                ${player.ping || 0}ms
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = resultsHtml;
    }

    /**
     * Test de l'API
     */
    async testAPI() {
        const endpoint = this.elements.apiEndpoint?.value;
        if (!endpoint) return;
        
        try {
            this.elements.testButton.disabled = true;
            this.elements.testButton.textContent = 'Test en cours...';
            
            const response = await this.apiCall(endpoint);
            this.displayAPIResponse(response, endpoint);
            
        } catch (error) {
            this.displayAPIResponse({ 
                success: false, 
                error: error.message, 
                timestamp: new Date().toISOString() 
            }, endpoint);
        } finally {
            this.elements.testButton.disabled = false;
            this.elements.testButton.textContent = 'Tester';
        }
    }

    /**
     * Affichage de la réponse API
     */
    displayAPIResponse(response, endpoint) {
        if (!this.elements.apiResponse) return;
        
        const formattedResponse = JSON.stringify(response, null, 2);
        const statusClass = response.success ? 'success' : 'error';
        
        this.elements.apiResponse.innerHTML = `
            <div class="api-response-header ${statusClass}">
                <span class="endpoint">${endpoint}</span>
                <span class="status">${response.success ? '✅ Succès' : '❌ Erreur'}</span>
            </div>
            <pre class="api-response-body"><code>${formattedResponse}</code></pre>
        `;
    }

    /**
     * Appel API générique avec gestion d'erreur
     */
    async apiCall(endpoint) {
        const url = `${this.config.apiBaseUrl}${endpoint}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    /**
     * Actualisation des données
     */
    async refreshData() {
        console.log('🔄 Actualisation des données...');
        
        try {
            await this.loadInitialData();
            this.updateLastUpdateTime();
            this.showSuccess('Données actualisées');
        } catch (error) {
            console.error('Erreur lors de l\'actualisation:', error);
            this.showError('Erreur d\'actualisation', error.message);
        }
    }

    /**
     * Démarrage de la mise à jour automatique
     */
    startAutoUpdate() {
        this.stopAutoUpdate();
        
        this.updateTimer = setInterval(async () => {
            try {
                await this.loadInitialData();
                this.updateLastUpdateTime();
            } catch (error) {
                console.warn('Erreur lors de la mise à jour automatique:', error);
                this.handleError(error);
            }
        }, this.config.updateInterval);
        
        console.log(`⏰ Mise à jour automatique démarrée (${this.config.updateInterval/1000}s)`);
    }

    /**
     * Arrêt de la mise à jour automatique
     */
    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * Ouvre le modal avec les détails du joueur
     */
    openPlayerModal(player) {
        console.log('🔍 openPlayerModal appelé avec:', player);
        
        const modal = document.getElementById('playerModal');
        if (!modal) {
            console.log('❌ Modal playerModal introuvable');
            return;
        }

        // Remplir les informations du joueur
        const nameEl = document.getElementById('modalPlayerName');
        const idEl = document.getElementById('modalPlayerId');
        const pingEl = document.getElementById('modalPlayerPing');
        
        if (nameEl) nameEl.textContent = player.name || 'Joueur inconnu';
        if (idEl) idEl.textContent = player.id || '-';
        if (pingEl) pingEl.textContent = `${player.ping || 0}ms`;

        // Identifiants
        const identifiersContainer = document.getElementById('modalPlayerIdentifiers');
        if (identifiersContainer) {
            identifiersContainer.innerHTML = '';
            
            if (player.identifiers && player.identifiers.length > 0) {
                player.identifiers.forEach(identifier => {
                    const identifierDiv = document.createElement('div');
                    identifierDiv.className = 'identifier-item';
                    identifierDiv.textContent = identifier;
                    identifiersContainer.appendChild(identifierDiv);
                });
            } else {
                identifiersContainer.innerHTML = '<div class="identifier-item">Aucun identifiant disponible</div>';
            }
        }

        // Informations de session
        const sessionEl = document.getElementById('modalSessionTime');
        const endpointEl = document.getElementById('modalPlayerEndpoint');
        
        if (sessionEl) sessionEl.textContent = this.formatDuration(player.sessionDuration || 0);
        if (endpointEl) endpointEl.textContent = player.endpoint || 'Non disponible';

        // Statistiques
        const avgPingEl = document.getElementById('modalAvgPing');
        const totalTimeEl = document.getElementById('modalTotalTime');
        
        if (avgPingEl) avgPingEl.textContent = `${player.ping || 0}ms`;
        if (totalTimeEl) totalTimeEl.textContent = this.formatDuration(player.totalTime || 0);

        // Afficher le modal
        console.log('✅ Ouverture du modal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Empêcher le scroll
    }

    /**
     * Recharge le graphique avec une nouvelle période glissante
     */
    async reloadChart(period = '24h') {
        if (!this.chart) return;

        console.log(`📊 Rechargement du graphique pour la période: ${period}`);

        // Mettre à jour l'indicateur de période
        this.updatePeriodInfo(period);

        // Récupérer les nouvelles données historiques
        const historyData = await this.fetchHistoryData(period);
        
        if (historyData && historyData.history && historyData.history.length > 0) {
            const labels = historyData.history.map(entry => {
                const date = new Date(entry.timestamp);
                if (period === '24h') {
                    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                } else if (period === '7d') {
                    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                } else {
                    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                }
            });
            const data = historyData.history.map(entry => entry.playerCount);

            // Mettre à jour les données du graphique
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = data;
            
            // Mettre à jour le titre de l'axe X selon la période
            let xAxisTitle = 'Temps';
            if (period === '24h') xAxisTitle = 'Heure (dernières 24h)';
            else if (period === '7d') xAxisTitle = 'Jour (7 derniers jours)';
            else if (period === '30d') xAxisTitle = 'Jour (30 derniers jours)';
            
            this.chart.options.scales.x.title.text = xAxisTitle;
            
            // Animer le changement
            this.chart.update('active');
            
            // Mettre à jour les données locales
            this.chartData = {
                labels: labels,
                data: data,
                maxDataPoints: period === '24h' ? 48 : (period === '7d' ? 7 : 30),
                period: period
            };

            console.log(`✅ Graphique rechargé avec ${data.length} points de données pour ${period} (plage glissante)`);
            
            // Afficher les informations de plage temporelle
            if (historyData.timeRange) {
                const from = new Date(historyData.timeRange.from).toLocaleString('fr-FR');
                const to = new Date(historyData.timeRange.to).toLocaleString('fr-FR');
                console.log(`📅 Plage temporelle: ${from} → ${to}`);
            }
        }
    }

    /**
     * Met à jour l'indicateur de période dans l'interface
     */
    updatePeriodInfo(period) {
        const periodInfoElement = document.getElementById('chartPeriodInfo');
        if (periodInfoElement) {
            let periodText = '';
            switch (period) {
                case '24h':
                    periodText = 'Dernières 24 heures glissantes';
                    break;
                case '7d':
                    periodText = '7 derniers jours glissants';
                    break;
                case '30d':
                    periodText = '30 derniers jours glissants';
                    break;
                default:
                    periodText = 'Période sélectionnée';
            }
            periodInfoElement.textContent = periodText;
        }
    }

    /**
     * Mise à jour du graphique avec de nouvelles données
     */
    updateChart(currentPlayers) {
        if (!this.chart || !this.chartData) return;

        const now = new Date();
        const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        // Ajouter le nouveau point de données
        this.chartData.labels.push(timeLabel);
        this.chartData.data.push(currentPlayers);
        
        // Limiter le nombre de points de données
        if (this.chartData.labels.length > this.chartData.maxDataPoints) {
            this.chartData.labels.shift();
            this.chartData.data.shift();
        }
        
        // Mettre à jour le graphique
        this.chart.data.labels = this.chartData.labels;
        this.chart.data.datasets[0].data = this.chartData.data;
        this.chart.update('none'); // Animation désactivée pour les mises à jour temps réel
        
        console.log(`📊 Graphique mis à jour: ${currentPlayers} joueurs à ${timeLabel}`);
    }

    /**
     * Initialisation du graphique Chart.js
     */
    initChart() {
        const canvas = document.getElementById('activityChart');
        if (!canvas) {
            console.warn('⚠️ Canvas du graphique non trouvé');
            return;
        }

        const ctx = canvas.getContext('2d');
        
        // Configuration du graphique
        this.chartData = {
            labels: [],
            data: [],
            maxDataPoints: 50
        };

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.chartData.labels,
                datasets: [{
                    label: 'Joueurs connectés',
                    data: this.chartData.data,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Temps'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Nombre de joueurs'
                        },
                        beginAtZero: true
                    }
                }
            }
        });

        console.log('📊 Graphique Chart.js initialisé');
    }

    /**
     * Affichage des erreurs
     */
    showError(title, message) {
        console.error(`❌ ${title}: ${message}`);
        
        // Créer une notification d'erreur
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h4>${title}</h4>
                <p>${message}</p>
                <button class="error-close-btn">Fermer</button>
            </div>
        `;
        
        // Ajouter les styles si ils n'existent pas
        if (!document.querySelector('style[data-error-styles]')) {
            const style = document.createElement('style');
            style.setAttribute('data-error-styles', 'true');
            style.textContent = `
                .error-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #e74c3c;
                    color: white;
                    padding: 15px;
                    border-radius: 5px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    z-index: 1000;
                    max-width: 300px;
                }
                .error-content h4 {
                    margin: 0 0 10px 0;
                }
                .error-content p {
                    margin: 0 0 10px 0;
                }
                .error-content button {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 5px 10px;
                    border-radius: 3px;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(errorDiv);
        
        // Suppression automatique après 5 secondes
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    /**
     * Affichage/masquage de l'indicateur de chargement
     */
    showLoading(show = true) {
        let loader = document.getElementById('loadingIndicator');
        
        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'loadingIndicator';
                loader.className = 'loading-indicator';
                loader.innerHTML = `
                    <div class="loading-content">
                        <div class="loading-spinner"></div>
                        <p>Chargement des données...</p>
                    </div>
                `;
                
                // Ajouter les styles si ils n'existent pas
                if (!document.querySelector('style[data-loading-styles]')) {
                    const style = document.createElement('style');
                    style.setAttribute('data-loading-styles', 'true');
                    style.textContent = `
                        .loading-indicator {
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(0, 0, 0, 0.5);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            z-index: 9999;
                        }
                        .loading-content {
                            background: white;
                            padding: 30px;
                            border-radius: 10px;
                            text-align: center;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        }
                        .loading-spinner {
                            width: 40px;
                            height: 40px;
                            border: 4px solid #f3f3f3;
                            border-top: 4px solid #3498db;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 15px auto;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                document.body.appendChild(loader);
            }
            loader.style.display = 'flex';
        } else {
            if (loader) {
                loader.style.display = 'none';
            }
        }
        
        console.log(`${show ? '🔄' : '✅'} Loading: ${show ? 'affiché' : 'masqué'}`);
    }

    /**
     * Calcul de l'uptime du serveur
     */
    calculateUptime(uptimeDate) {
        if (!uptimeDate) return 'Inconnu';
        
        const startTime = new Date(uptimeDate);
        const now = new Date();
        const uptime = now - startTime;
        
        if (uptime < 0) return 'Inconnu';
        
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}j ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Mise à jour du temps de dernière actualisation
     */
    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Mettre à jour l'indicateur de dernière mise à jour
        let lastUpdateElement = document.getElementById('lastUpdate');
        if (!lastUpdateElement) {
            // Créer l'élément s'il n'existe pas
            lastUpdateElement = document.createElement('div');
            lastUpdateElement.id = 'lastUpdate';
            lastUpdateElement.className = 'last-update-indicator';
            lastUpdateElement.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(52, 152, 219, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                z-index: 1000;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(lastUpdateElement);
        }
        
        lastUpdateElement.innerHTML = `
            <i class="fas fa-sync-alt" style="margin-right: 5px;"></i>
            Dernière MAJ: ${timeString}
        `;
        
        // Animation de mise à jour
        lastUpdateElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            lastUpdateElement.style.transform = 'scale(1)';
        }, 200);
        
        console.log(`🕒 Dernière mise à jour: ${timeString}`);
    }

    /**
     * Affichage d'un message de succès
     */
    showSuccess(message) {
        console.log(`✅ ${message}`);
        
        // Créer une notification de succès
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.innerHTML = `
            <div class="success-content">
                <i class="fas fa-check-circle" style="margin-right: 10px;"></i>
                ${message}
            </div>
        `;
        
        // Ajouter les styles si ils n'existent pas
        if (!document.querySelector('style[data-success-styles]')) {
            const style = document.createElement('style');
            style.setAttribute('data-success-styles', 'true');
            style.textContent = `
                .success-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #27ae60;
                    color: white;
                    padding: 15px 20px;
                    border-radius: 5px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    z-index: 1000;
                    animation: slideInRight 0.3s ease;
                }
                .success-content {
                    display: flex;
                    align-items: center;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(successDiv);
        
        // Suppression automatique après 3 secondes
        setTimeout(() => {
            successDiv.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                if (successDiv.parentElement) {
                    successDiv.remove();
                }
            }, 300);
        }, 3000);
    }

    /**
     * Extrait l'identifiant principal d'un joueur
     */
    getMainIdentifier(player) {
        if (!player || !player.identifiers || !Array.isArray(player.identifiers)) {
            return 'Aucun identifiant';
        }
        
        // Priorité aux identifiants Steam
        const steamId = player.identifiers.find(id => id.startsWith('steam:'));
        if (steamId) {
            return steamId.replace('steam:', 'Steam: ');
        }
        
        // Si pas de Steam, prendre le premier identifiant disponible
        const firstId = player.identifiers[0];
        if (firstId) {
            if (firstId.startsWith('discord:')) {
                return firstId.replace('discord:', 'Discord: ');
            } else if (firstId.startsWith('license:')) {
                return firstId.replace('license:', 'License: ');
            } else if (firstId.startsWith('xbl:')) {
                return firstId.replace('xbl:', 'Xbox: ');
            } else if (firstId.startsWith('live:')) {
                return firstId.replace('live:', 'Live: ');
            } else if (firstId.startsWith('fivem:')) {
                return firstId.replace('fivem:', 'FiveM: ');
            }
            return firstId;
        }
        
        return 'Aucun identifiant';
    }

    /**
     * Détermine la classe CSS pour le ping
     */
    getPingClass(ping) {
        if (ping < 50) return 'ping-good';
        if (ping < 100) return 'ping-ok';
        if (ping < 200) return 'ping-warning';
        return 'ping-bad';
    }

    /**
     * Formate une durée en minutes vers un format lisible
     */
    formatDuration(minutes) {
        if (!minutes || minutes < 1) return '0m';
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours > 0) {
            if (remainingMinutes > 0) {
                return `${hours}h ${remainingMinutes}m`;
            } else {
                return `${hours}h`;
            }
        } else {
            return `${remainingMinutes}m`;
        }
    }

    /**
     * Ouvre le modal d'un joueur
     */
    openPlayerModal(player) {
        console.log('🔍 Ouverture du modal pour:', player);
        
        // Créer le modal s'il n'existe pas
        let modal = document.getElementById('playerModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'playerModal';
            modal.className = 'player-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalPlayerName">Détails du joueur</h3>
                        <button class="close-btn" data-modal="close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="player-details">
                            <div class="detail-row">
                                <strong>ID:</strong>
                                <span id="modalPlayerId"></span>
                            </div>
                            <div class="detail-row">
                                <strong>Ping:</strong>
                                <span id="modalPlayerPing"></span>
                            </div>
                            <div class="detail-row">
                                <strong>Session actuelle:</strong>
                                <span id="modalPlayerSession"></span>
                            </div>
                            <div class="detail-row">
                                <strong>Temps total:</strong>
                                <span id="modalPlayerTotal"></span>
                            </div>
                            <div class="detail-row">
                                <strong>Endpoint:</strong>
                                <span id="modalPlayerEndpoint"></span>
                            </div>
                        </div>
                        <div class="identifiers-section">
                            <strong>Identifiants:</strong>
                            <div id="modalPlayerIdentifiers" class="identifiers-list"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-warning" data-action="kick">
                            <i class="fas fa-boot"></i> Expulser
                        </button>
                        <button class="btn btn-secondary" data-modal="close">
                            Fermer
                        </button>
                    </div>
                </div>
            `;
            
            // Ajouter les styles du modal
            if (!document.querySelector('style[data-modal-styles]')) {
                const style = document.createElement('style');
                style.setAttribute('data-modal-styles', 'true');
                style.textContent = `
                    .player-modal {
                        display: none;
                        position: fixed;
                        z-index: 10000;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0,0,0,0.5);
                        backdrop-filter: blur(5px);
                    }
                    .modal-content {
                        background-color: #fefefe;
                        margin: 5% auto;
                        padding: 0;
                        border-radius: 10px;
                        width: 90%;
                        max-width: 500px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        animation: modalSlideIn 0.3s ease;
                    }
                    .modal-header {
                        background: linear-gradient(135deg, #3498db, #2980b9);
                        color: white;
                        padding: 20px;
                        border-radius: 10px 10px 0 0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .modal-header h3 {
                        margin: 0;
                    }
                    .close-btn {
                        background: none;
                        border: none;
                        color: white;
                        font-size: 18px;
                        cursor: pointer;
                        padding: 5px;
                        border-radius: 3px;
                        transition: background 0.2s;
                    }
                    .close-btn:hover {
                        background: rgba(255,255,255,0.2);
                    }
                    .modal-body {
                        padding: 20px;
                    }
                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 10px;
                        padding: 8px 0;
                        border-bottom: 1px solid #eee;
                    }
                    .identifiers-section {
                        margin-top: 20px;
                    }
                    .identifiers-list {
                        margin-top: 10px;
                        background: #f8f9fa;
                        padding: 10px;
                        border-radius: 5px;
                        font-family: monospace;
                        font-size: 12px;
                    }
                    .modal-footer {
                        padding: 20px;
                        border-top: 1px solid #eee;
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                    }
                    .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        transition: all 0.2s;
                    }
                    .btn-warning {
                        background: #e74c3c;
                        color: white;
                    }
                    .btn-warning:hover {
                        background: #c0392b;
                    }
                    .btn-secondary {
                        background: #95a5a6;
                        color: white;
                    }
                    .btn-secondary:hover {
                        background: #7f8c8d;
                    }
                    @keyframes modalSlideIn {
                        from { transform: translateY(-50px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    .ping-good { color: #27ae60; }
                    .ping-ok { color: #f39c12; }
                    .ping-warning { color: #e67e22; }
                    .ping-bad { color: #e74c3c; }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(modal);
        }
        
        // Remplir les données du modal
        document.getElementById('modalPlayerName').textContent = player.name || 'Joueur inconnu';
        document.getElementById('modalPlayerId').textContent = player.id || '-';
        document.getElementById('modalPlayerPing').textContent = `${player.ping || 0}ms`;
        document.getElementById('modalPlayerSession').textContent = this.formatDuration(player.sessionDuration || 0);
        document.getElementById('modalPlayerTotal').textContent = this.formatDuration(player.totalTime || 0);
        document.getElementById('modalPlayerEndpoint').textContent = player.endpoint || 'Inconnu';
        
        // Afficher les identifiants
        const identifiersDiv = document.getElementById('modalPlayerIdentifiers');
        if (player.identifiers && player.identifiers.length > 0) {
            identifiersDiv.innerHTML = player.identifiers.map(id => `<div>${id}</div>`).join('');
        } else {
            identifiersDiv.innerHTML = '<div>Aucun identifiant disponible</div>';
        }
        
        // Afficher le modal
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    /**
     * Récupère les données historiques depuis l'API
     */
    async fetchHistoryData(period = '24h') {
        try {
            console.log(`📊 Récupération des données historiques pour: ${period}`);
            
            const response = await fetch(`${this.config.apiBaseUrl}/history?period=${period}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Erreur lors de la récupération des données');
            }
            
            console.log(`✅ Données historiques récupérées: ${data.data.history.length} points`);
            return data.data;
            
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des données historiques:', error);
            this.showError('Erreur de données', `Impossible de charger les données historiques: ${error.message}`);
            return null;
        }
    }

    /**
     * Mise à jour des meilleurs joueurs
     */
    async updateTopPlayers() {
        try {
            console.log('📊 Mise à jour des meilleurs joueurs...');
            
            // Récupérer toutes les données du serveur
            const response = await this.apiCall('/server-info');
            
            if (response.success && response.data) {
                const players = response.data.players?.current || [];
                
                // Trier les joueurs par temps total décroissant
                const topPlayers = players
                    .filter(player => player.totalTime > 0) // Seulement les joueurs avec du temps
                    .sort((a, b) => (b.totalTime || 0) - (a.totalTime || 0))
                    .slice(0, 10); // Top 10
                
                this.displayTopPlayers(topPlayers);
            } else {
                this.displayTopPlayers([]);
            }
        } catch (error) {
            console.error('❌ Erreur updateTopPlayers:', error);
            this.displayTopPlayers([]);
        }
    }

    /**
     * Affichage des meilleurs joueurs
     */
    displayTopPlayers(players) {
        const container = document.getElementById('topPlayersList');
        if (!container) return;

        if (!players || players.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>Aucun joueur avec historique disponible</p>
                </div>
            `;
            return;
        }

        container.innerHTML = players.map((player, index) => {
            const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
            const totalSessions = 1; // Pour l'instant, nous n'avons pas cette donnée
            
            return `
                <div class="top-player-item">
                    <div class="player-rank ${rankClass}">${index + 1}</div>
                    <div class="player-info">
                        <div class="player-name">${player.name || 'Joueur inconnu'}</div>
                        <div class="player-steam">${this.getMainIdentifier(player)}</div>
                    </div>
                    <div class="player-time">${this.formatDuration(player.totalTime || 0)}</div>
                    <div class="player-sessions">${totalSessions} séance${totalSessions > 1 ? 's' : ''}</div>
                </div>
            `;
        }).join('');

        console.log(`✅ ${players.length} meilleurs joueurs affichés`);
    }

    /**
     * Ferme le modal du joueur
     */
    closePlayerModal() {
        const modal = document.getElementById('playerModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    /**
     * Action d'expulsion d'un joueur (placeholder)
     */
    kickPlayer() {
        alert('Fonctionnalité admin à implémenter');
        this.closePlayerModal();
    }

    // ...existing code...
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Initialisation du Dashboard FiveM Pro...');
    
    try {
        window.fivemDashboard = new FiveMDashboard();
    } catch (error) {
        console.error('❌ Erreur fatale lors de l\'initialisation:', error);
        
        // Affichage d'erreur de fallback
        const errorDiv = document.createElement('div');
        errorDiv.className = 'initialization-error';
        errorDiv.innerHTML = `
            <h2>❌ Erreur d'initialisation</h2>
            <p>Impossible de démarrer le dashboard.</p>
            <p><strong>Erreur:</strong> ${error.message}</p>
            <button class="reload-btn">🔄 Recharger la page</button>
        `;
        
        document.body.insertBefore(errorDiv, document.body.firstChild);
    }
});

// Note: Les fonctions de modal sont maintenant gérées par la classe FiveMDashboard
