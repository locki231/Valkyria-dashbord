class FiveMMonitor {
    constructor() {
        this.updateInterval = null;
        this.charts = {};
        this.playerHistory = [];
        this.connectionData = { joined: 0, left: 0 };
        this.pingData = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initCharts();
        this.startAutoUpdate();
        this.updateData();
    }

    setupEventListeners() {
        // Recherche de joueur avec Enter
        document.getElementById('playerSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchPlayer();
            }
        });

        // Auto-recherche lors de la saisie
        document.getElementById('playerSearch').addEventListener('input', 
            this.debounce(() => this.searchPlayer(), 500)
        );
    }

    startAutoUpdate() {
        // Mettre à jour toutes les 30 secondes
        this.updateInterval = setInterval(() => {
            this.updateData();
        }, 30000);
    }

    async updateData() {
        try {
            await Promise.all([
                this.updateServerInfo(),
                this.updateCurrentPlayers(),
                this.updateTopPlayers(),
                this.updateActivity()
            ]);
            this.updateCharts();
        } catch (error) {
            console.error('Erreur lors de la mise à jour:', error);
            this.showError('Erreur de connexion au serveur');
        }
    }

    async updateServerInfo() {
        try {
            const response = await fetch('/api/server-info');
            const data = await response.json();

            // Mettre à jour les statistiques principales
            document.getElementById('currentPlayers').textContent = data.currentPlayers || 0;
            document.getElementById('maxPlayers').textContent = data.maxPlayers || 32;
            document.getElementById('peakToday').textContent = data.peakToday || 0;
            document.getElementById('totalConnections').textContent = data.totalConnections || 0;
            document.getElementById('serverStatus').textContent = data.status === 'online' ? 'En ligne' : 'Hors ligne';

            // Mettre à jour l'indicateur de statut
            const statusIndicator = document.querySelector('.status-dot');
            const statusText = document.getElementById('statusText');
            
            if (data.status === 'online') {
                statusIndicator.classList.add('online');
                statusText.textContent = `En ligne - ${data.serverName || 'Serveur FiveM'}`;
            } else {
                statusIndicator.classList.remove('online');
                statusText.textContent = 'Serveur hors ligne';
            }

            // Mettre à jour la dernière mise à jour
            if (data.lastUpdate) {
                const lastUpdate = new Date(data.lastUpdate);
                document.getElementById('lastUpdate').textContent = this.formatTime(lastUpdate);
            }

            // Ajouter aux données historiques pour les graphiques
            this.playerHistory.push({
                time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                players: data.currentPlayers || 0
            });

            // Garder seulement les 20 dernières entrées
            if (this.playerHistory.length > 20) {
                this.playerHistory.shift();
            }

        } catch (error) {
            console.error('Erreur lors de la récupération des infos serveur:', error);
        }
    }

    async updateCurrentPlayers() {
        try {
            const response = await fetch('/api/players');
            const data = await response.json();

            const playersList = document.getElementById('currentPlayersList');
            
            if (data.current && data.current.length > 0) {
                playersList.innerHTML = data.current.map(player => `
                    <div class="current-player-item">
                        <div class="player-info">
                            <div class="player-name">${this.escapeHtml(player.name || 'Joueur inconnu')}</div>
                            <div class="player-id">ID: ${player.id}</div>
                        </div>
                        <div class="player-ping">${player.ping || 0}ms</div>
                    </div>
                `).join('');
            } else {
                playersList.innerHTML = '<div class="no-data">Aucun joueur connecté</div>';
            }

            // Mettre à jour les données de ping pour le graphique
            if (data.current && data.current.length > 0) {
                this.pingData = data.current.map(player => ({
                    name: player.name || 'Joueur',
                    ping: player.ping || 0
                }));
            }

        } catch (error) {
            console.error('Erreur lors de la récupération des joueurs:', error);
        }
    }

    async updateTopPlayers() {
        try {
            const response = await fetch('/api/top-players');
            const data = await response.json();

            const topPlayersList = document.getElementById('topPlayers');
            
            if (data && data.length > 0) {
                topPlayersList.innerHTML = data.map((player, index) => `
                    <div class="top-player-item">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div class="player-rank">${index + 1}</div>
                            <div>
                                <div class="player-name">${this.escapeHtml(player.name)}</div>
                                <div style="opacity: 0.7; font-size: 0.8rem;">
                                    ${player.connections} connexions • ${this.formatDuration(player.totalTime)}
                                </div>
                            </div>
                        </div>
                        <div style="opacity: 0.7; font-size: 0.8rem;">
                            ${this.formatTime(new Date(player.lastSeen))}
                        </div>
                    </div>
                `).join('');
            } else {
                topPlayersList.innerHTML = '<div class="no-data">Aucune donnée disponible</div>';
            }

        } catch (error) {
            console.error('Erreur lors de la récupération du top joueurs:', error);
        }
    }

    async updateActivity() {
        try {
            const response = await fetch('/api/activity');
            const data = await response.json();

            const activityList = document.getElementById('playerActivity');
            
            if (data.recent && data.recent.length > 0) {
                // Compter les connexions et déconnexions
                let joinedCount = 0;
                let leftCount = 0;
                
                data.recent.forEach(activity => {
                    if (activity.action === 'joined') joinedCount++;
                    if (activity.action === 'left') leftCount++;
                });
                
                this.connectionData = { joined: joinedCount, left: leftCount };

                activityList.innerHTML = data.recent.slice(-10).reverse().map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon ${activity.action}"></div>
                        <div class="activity-text">
                            <div class="player-name">${this.escapeHtml(activity.playerName)}</div>
                            <div class="activity-details">
                                ${activity.playerId ? `ID: ${activity.playerId} • ` : ''}${activity.action === 'joined' ? 'a rejoint le serveur' : 'a quitté le serveur'}
                            </div>
                        </div>
                        <div class="activity-time">${this.formatTime(new Date(activity.timestamp))}</div>
                    </div>
                `).join('');
            } else {
                activityList.innerHTML = '<div class="no-data">Aucune activité récente</div>';
            }

        } catch (error) {
            console.error('Erreur lors de la récupération de l\'activité:', error);
        }
    }

    async searchPlayer() {
        const searchTerm = document.getElementById('playerSearch').value.trim();
        const resultsContainer = document.getElementById('searchResults');

        if (!searchTerm) {
            resultsContainer.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`/api/search-player/${encodeURIComponent(searchTerm)}`);
            const players = await response.json();

            if (players && players.length > 0) {
                resultsContainer.innerHTML = players.map(player => `
                    <div class="player-card">
                        <div class="player-info">
                            <h4>${this.escapeHtml(player.name || 'Joueur inconnu')}</h4>
                            <p>ID: ${player.id}</p>
                        </div>
                        <div class="player-ping">${player.ping || 0}ms</div>
                    </div>
                `).join('');
            } else {
                resultsContainer.innerHTML = '<div class="no-data">Aucun joueur trouvé</div>';
            }

        } catch (error) {
            console.error('Erreur lors de la recherche:', error);
            resultsContainer.innerHTML = '<div class="error">Erreur lors de la recherche</div>';
        }
    }

    initCharts() {
        // Graphique de l'activité des joueurs
        const playersCtx = document.getElementById('playersChart').getContext('2d');
        this.charts.players = new Chart(playersCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Joueurs connectés',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });

        // Graphique des connexions
        const connectionsCtx = document.getElementById('connectionsChart').getContext('2d');
        this.charts.connections = new Chart(connectionsCtx, {
            type: 'doughnut',
            data: {
                labels: ['Connexions', 'Déconnexions'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#4CAF50', '#f44336'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                }
            }
        });

        // Graphique du ping
        const pingCtx = document.getElementById('pingChart').getContext('2d');
        this.charts.ping = new Chart(pingCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Ping (ms)',
                    data: [],
                    backgroundColor: 'rgba(33, 150, 243, 0.8)',
                    borderColor: '#2196F3',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }

    updateCharts() {
        // Mettre à jour le graphique des joueurs
        if (this.charts.players) {
            this.charts.players.data.labels = this.playerHistory.map(entry => entry.time);
            this.charts.players.data.datasets[0].data = this.playerHistory.map(entry => entry.players);
            this.charts.players.update('none');
        }

        // Mettre à jour le graphique des connexions
        if (this.charts.connections) {
            this.charts.connections.data.datasets[0].data = [
                this.connectionData.joined,
                this.connectionData.left
            ];
            this.charts.connections.update('none');
        }

        // Mettre à jour le graphique du ping
        if (this.charts.ping && this.pingData.length > 0) {
            const sortedPingData = this.pingData.sort((a, b) => b.ping - a.ping).slice(0, 10);
            this.charts.ping.data.labels = sortedPingData.map(player => 
                player.name.length > 12 ? player.name.substring(0, 12) + '...' : player.name
            );
            this.charts.ping.data.datasets[0].data = sortedPingData.map(player => player.ping);
            this.charts.ping.update('none');
        }
    }

    // Utilitaires
    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Moins d'une minute
            return 'Il y a quelques secondes';
        } else if (diff < 3600000) { // Moins d'une heure
            const minutes = Math.floor(diff / 60000);
            return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
        } else if (diff < 86400000) { // Moins d'un jour
            const hours = Math.floor(diff / 3600000);
            return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
        } else {
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showError(message) {
        // Créer une notification d'erreur
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    new FiveMMonitor();
});

// Fonction globale pour la recherche (appelée depuis le HTML)
function searchPlayer() {
    const monitor = window.fivemMonitor || new FiveMMonitor();
    monitor.searchPlayer();
}
