const pool = require('../config/db');

// Get dashboard stats for the current user
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get match count
    const matchCountQuery = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS today,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS week,
        COUNT(*) AS total
      FROM matches 
      WHERE user1_id = $1 OR user2_id = $1`,
      [userId]
    );
    
    // Get message count
    const messageCountQuery = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '24 hours' AND ms.is_read = false) AS today,
        COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days' AND ms.is_read = false) AS week,
        COUNT(*) FILTER (WHERE ms.is_read = false) AS unread,
        COUNT(*) AS total
      FROM messages m
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = $1
      WHERE cp.user_id = $1 AND m.sender_id != $1`,
      [userId]
    );
    
    // Get profile view count
    const profileViewQuery = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '24 hours') AS today,
        COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days') AS week,
        COUNT(*) AS total
      FROM profile_views 
      WHERE viewed_user_id = $1`,
      [userId]
    );
    
    // Format the response
    const stats = {
      matches: {
        today: parseInt(matchCountQuery.rows[0].today || 0),
        week: parseInt(matchCountQuery.rows[0].week || 0),
        total: parseInt(matchCountQuery.rows[0].total || 0)
      },
      messages: {
        today: parseInt(messageCountQuery.rows[0].today || 0),
        week: parseInt(messageCountQuery.rows[0].week || 0),
        unread: parseInt(messageCountQuery.rows[0].unread || 0),
        total: parseInt(messageCountQuery.rows[0].total || 0)
      },
      profileViews: {
        today: parseInt(profileViewQuery.rows[0].today || 0),
        week: parseInt(profileViewQuery.rows[0].week || 0),
        total: parseInt(profileViewQuery.rows[0].total || 0)
      }
    };
    
    res.json(stats);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// Get recent activity for the current user
// backend/controllers/dashboardController.js

// Get recent activity for the current user
exports.getRecentActivity = async (req, res) => {
  console.log('getRecentActivity called with user ID:', req.user?.id);
  try {
    if (!req.user?.id) {
      console.error('No user ID in request');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;

    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      console.error('User not found with ID:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const activities = [];
    
    // Get recent matches (past 7 days)
    const matchesQuery = await pool.query(
      `SELECT m.id, m.created_at, 
        CASE 
          WHEN m.user1_id = $1 THEN p2.first_name
          ELSE p1.first_name
        END AS other_user_name,
        CASE 
          WHEN m.user1_id = $1 THEN COALESCE(p2.profile_picture, p2.profile_pic)
          ELSE COALESCE(p1.profile_picture, p1.profile_pic)
        END AS profile_picture,
        CASE 
          WHEN m.user1_id = $1 THEN m.user2_id
          ELSE m.user1_id
        END AS other_user_id
      FROM matches m
      LEFT JOIN profiles p1 ON m.user1_id = p1.user_id
      LEFT JOIN profiles p2 ON m.user2_id = p2.user_id
      WHERE (m.user1_id = $1 OR m.user2_id = $1)
        AND m.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY m.created_at DESC
      LIMIT 5`,
      [userId]
    );
    
    for (const match of matchesQuery.rows) {
      activities.push({
        type: 'match',
        title: 'New Match!',
        description: `You and ${match.other_user_name} have liked each other`,
        time: match.created_at,
        userId: match.other_user_id,
        profilePicture: match.profile_picture || '/default-avatar.png'
      });
    }
    
    // Get recent messages (past 7 days) - FIXED QUERY
    const messagesQuery = await pool.query(
      `SELECT m.id, m.created_at, m.content, 
              p.first_name, -- FIXED: Select first_name from profiles (aliased as p)
              COALESCE(p.profile_picture, p.profile_pic) as profile_picture, 
              m.sender_id
      FROM messages m
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      LEFT JOIN profiles p ON m.sender_id = p.user_id -- FIXED: Join profiles on sender_id
      WHERE cp.user_id = $1
        AND m.sender_id != $1
        AND m.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY m.created_at DESC
      LIMIT 5`,
      [userId]
    );
    
    for (const message of messagesQuery.rows) {
      activities.push({
        type: 'message',
        title: 'Message Received',
        description: `${message.first_name || 'Someone'} sent you a message: "${message.content.substring(0, 30)}${message.content.length > 30 ? '...' : ''}"`,
        time: message.created_at,
        userId: message.sender_id,
        profilePicture: message.profile_picture || '/default-avatar.png'
      });
    }
    
    // Get recent profile views (past 7 days) - FIXED QUERY
    const viewsQuery = await pool.query(
      `SELECT pv.id, pv.viewed_at, p.first_name, -- FIXED: Select first_name from profiles (aliased as p)
              COALESCE(p.profile_picture, p.profile_pic) as profile_picture, 
              pv.viewer_id
      FROM profile_views pv
      LEFT JOIN profiles p ON pv.viewer_id = p.user_id -- FIXED: Join profiles on viewer_id
      WHERE pv.viewed_user_id = $1
        AND pv.viewed_at >= NOW() - INTERVAL '7 days'
      ORDER BY pv.viewed_at DESC
      LIMIT 5`,
      [userId]
    );
    
    for (const view of viewsQuery.rows) {
      activities.push({
        type: 'view',
        title: 'Profile Viewed',
        description: `${view.first_name || 'Someone'} viewed your profile`,
        time: view.viewed_at,
        userId: view.viewer_id,
        profilePicture: view.profile_picture || '/default-avatar.png'
      });
    }
    
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    const formatRelativeTime = (date) => {
      const now = new Date();
      const diffMs = now - new Date(date);
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };
    
    activities.forEach(activity => {
      activity.relativeTime = formatRelativeTime(activity.time);
    });
    
    res.json(activities.slice(0, 10));
  } catch (err) {
    console.error('Error fetching recent activity:', {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    try {
      await pool.query(
        'INSERT INTO error_logs (user_id, endpoint, error_message, stack_trace, created_at) VALUES ($1, $2, $3, $4, $5)',
        [req.user?.id, '/api/dashboard/activity', err.message, err.stack, new Date()]
      );
    } catch (dbErr) {
      console.error('Failed to log error to database:', dbErr);
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch recent activity',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};