import { queueService } from '../services/queueService.js';
import { supabaseService } from '../services/supabaseService.js';
import { logger } from '../utils/logger.js';

// Simple dashboard for queue monitoring
export const getSimpleDashboard = async (req, res) => {
  try {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Queue Dashboard</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                background-color: #f5f5f5; 
            }
            .container { 
                max-width: 1200px; 
                margin: 0 auto; 
                background: white; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            }
            .header { 
                text-align: center; 
                color: #333; 
                margin-bottom: 30px; 
            }
            .stats { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
                gap: 20px; 
                margin-bottom: 30px; 
            }
            .stat-card { 
                background: #f8f9fa; 
                padding: 20px; 
                border-radius: 8px; 
                text-align: center; 
                border-left: 4px solid #007bff; 
            }
            .stat-card.success { border-left-color: #28a745; }
            .stat-card.warning { border-left-color: #ffc107; }
            .stat-card.danger { border-left-color: #dc3545; }
            .stat-number { 
                font-size: 2em; 
                font-weight: bold; 
                margin-bottom: 5px; 
            }
            .stat-label { 
                color: #666; 
                font-size: 0.9em; 
            }
            .actions { 
                margin: 20px 0; 
                text-align: center; 
            }
            .btn { 
                background: #007bff; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 4px; 
                cursor: pointer; 
                margin: 0 10px; 
                text-decoration: none; 
                display: inline-block; 
            }
            .btn:hover { background: #0056b3; }
            .btn.danger { background: #dc3545; }
            .btn.danger:hover { background: #c82333; }
            .refresh-info { 
                text-align: center; 
                color: #666; 
                margin-top: 20px; 
                font-size: 0.9em; 
            }
            .webhook-events { 
                margin-top: 30px; 
            }
            .event-grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
                gap: 15px; 
                margin-top: 15px; 
            }
            .event-card { 
                background: #f8f9fa; 
                padding: 15px; 
                border-radius: 6px; 
                border-left: 3px solid #17a2b8; 
            }
            .event-name { 
                font-weight: bold; 
                color: #333; 
                margin-bottom: 5px; 
            }
            .event-count { 
                color: #666; 
                font-size: 0.9em; 
            }
        </style>
        <script>
            // Auto-refresh every 10 seconds
            setTimeout(() => {
                window.location.reload();
            }, 10000);
            
            async function clearQueue(type) {
                if (confirm('Are you sure you want to clear ' + type + ' jobs?')) {
                    try {
                        const response = await fetch('/api/payments/admin/clear-queue', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                            },
                            body: JSON.stringify({ type: type })
                        });
                        
                        if (response.ok) {
                            alert('Queue cleared successfully');
                            window.location.reload();
                        } else {
                            alert('Failed to clear queue');
                        }
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                }
            }
        </script>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Payment Queue Dashboard</h1>
                <p>Real-time monitoring of webhook processing</p>
            </div>
            
            <div id="stats-container">
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number" id="waiting-count">-</div>
                        <div class="stat-label">Waiting Jobs</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-number" id="active-count">-</div>
                        <div class="stat-label">Active Jobs</div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-number" id="completed-count">-</div>
                        <div class="stat-label">Completed Jobs</div>
                    </div>
                    <div class="stat-card danger">
                        <div class="stat-number" id="failed-count">-</div>
                        <div class="stat-label">Failed Jobs</div>
                    </div>
                </div>
            </div>
            
            <div class="actions">
                <a href="/api/payments/health" class="btn" target="_blank">📊 API Health</a>
                <a href="/admin/queues" class="btn" target="_blank">🔧 Full Dashboard</a>
                <button class="btn danger" onclick="clearQueue('failed')">🗑️ Clear Failed Jobs</button>
                <button class="btn danger" onclick="clearQueue('completed')">🗑️ Clear Completed Jobs</button>
            </div>
            
            <div class="webhook-events">
                <h3>📡 Webhook Events Processed (Last 24h)</h3>
                <div class="event-grid" id="events-container">
                    <!-- Events will be loaded here -->
                </div>
            </div>
            
            <div class="refresh-info">
                ⏱️ Auto-refreshing every 10 seconds | Last updated: <span id="last-updated"></span>
            </div>
        </div>
        
        <script>
            // Load stats on page load
            async function loadStats() {
                try {
                    const response = await fetch('/api/payments/health');
                    const data = await response.json();
                    
                    if (data.queue && typeof data.queue === 'object') {
                        document.getElementById('waiting-count').textContent = data.queue.waiting || 0;
                        document.getElementById('active-count').textContent = data.queue.active || 0;
                        document.getElementById('completed-count').textContent = data.queue.completed || 0;
                        document.getElementById('failed-count').textContent = data.queue.failed || 0;
                    }
                    
                    document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
                } catch (error) {
                    console.error('Failed to load stats:', error);
                }
            }
            
            // Load webhook events
            async function loadEvents() {
                try {
                    const response = await fetch('/api/payments/admin/webhook-stats');
                    const data = await response.json();
                    
                    if (data.success && data.events) {
                        const container = document.getElementById('events-container');
                        container.innerHTML = '';
                        
                        data.events.forEach(event => {
                            const eventCard = document.createElement('div');
                            eventCard.className = 'event-card';
                            eventCard.innerHTML = \`
                                <div class="event-name">\${event.event_type}</div>
                                <div class="event-count">Processed: \${event.count} times</div>
                            \`;
                            container.appendChild(eventCard);
                        });
                    }
                } catch (error) {
                    console.error('Failed to load events:', error);
                }
            }
            
            // Load data on page load
            loadStats();
            loadEvents();
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    logger.error('Error generating simple dashboard:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

// Get webhook statistics
export const getWebhookStats = async (req, res) => {
  try {
    // Get webhook events from last 24 hours
    const client = supabaseService.initializeSupabase();
    const { data: events, error } = await client
      .from('webhook_events')
      .select('event_type')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .eq('processed', true);
    
    if (error) throw error;
    
    // Count events by type
    const eventCounts = {};
    events.forEach(event => {
      eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1;
    });
    
    // Convert to array and sort by count
    const eventStats = Object.entries(eventCounts)
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      events: eventStats,
      total: events.length,
      period: '24 hours'
    });
  } catch (error) {
    logger.error('Error getting webhook stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook statistics'
    });
  }
};

// Clear queue jobs
export const clearQueue = async (req, res) => {
  try {
    const { type } = req.body; // 'failed' or 'completed'
    
    if (!['failed', 'completed'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid queue type. Use "failed" or "completed"'
      });
    }
    
    const queue = queueService.getQueue();
    if (!queue) {
      return res.status(500).json({
        success: false,
        error: 'Queue not initialized'
      });
    }
    
    let count = 0;
    if (type === 'failed') {
      const failedJobs = await queue.getFailed();
      count = failedJobs.length;
      await queue.clean(0, 1000, 'failed');
    } else if (type === 'completed') {
      const completedJobs = await queue.getCompleted();
      count = completedJobs.length;
      await queue.clean(0, 1000, 'completed');
    }
    
    logger.info(`Cleared ${count} ${type} jobs from queue`);
    
    res.json({
      success: true,
      message: `Cleared ${count} ${type} jobs`,
      count: count
    });
  } catch (error) {
    logger.error('Error clearing queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear queue'
    });
  }
};