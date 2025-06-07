const pool = require('../config/db');

exports.getReportedContent = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching reported content summary...');
    const { type } = req.query;
    
    // Get summary counts for each type
    const summary = await client.query(`
      SELECT type, COUNT(*) as count
      FROM reported_content
      WHERE status = 'pending'
      GROUP BY type
    `);

    console.log('Summary counts:', summary.rows);

    // If type is specified, get detailed reports for that type
    let reports = [];
    if (type) {
      console.log('Fetching detailed reports for type:', type);
      const result = await client.query(`
        SELECT 
          rc.id,
          rc.type,
          rc.reason,
          rc.status,
          rc.created_at,
          rc.content_id,
          reporter.email as reporter_email,
          CONCAT(reporter_profile.first_name, ' ', reporter_profile.last_name) as reporter_name,
          reported.email as reported_email,
          CONCAT(reported_profile.first_name, ' ', reported_profile.last_name) as reported_name,
          rc.notes
        FROM reported_content rc
        JOIN users reporter ON rc.reporter_id = reporter.id
        LEFT JOIN profiles reporter_profile ON reporter.id = reporter_profile.user_id
        JOIN users reported ON rc.reported_user_id = reported.id
        LEFT JOIN profiles reported_profile ON reported.id = reported_profile.user_id
        WHERE rc.type = $1 AND rc.status = 'pending'
        ORDER BY rc.created_at DESC
      `, [type]);
      reports = result.rows;
      console.log(`Found ${reports.length} reports for type ${type}`);
    }

    res.json({
      summary: summary.rows.reduce((acc, curr) => {
        acc[curr.type] = parseInt(curr.count);
        return acc;
      }, {}),
      reports
    });
  } catch (err) {
    console.error('Error in getReportedContent:', err);
    res.status(500).json({ 
      message: 'Failed to get reported content',
      error: err.message 
    });
  } finally {
    client.release();
  }
};

exports.getReportDetails = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Fetching report details for ID:', req.params.id);
    const { id } = req.params;
    
    const result = await client.query(`
      SELECT 
        rc.*,
        reporter.email as reporter_email,
        CONCAT(reporter_profile.first_name, ' ', reporter_profile.last_name) as reporter_name,
        reported.email as reported_email,
        CONCAT(reported_profile.first_name, ' ', reported_profile.last_name) as reported_name,
        reviewer.email as reviewer_email,
        CONCAT(reviewer_profile.first_name, ' ', reviewer_profile.last_name) as reviewer_name
      FROM reported_content rc
      JOIN users reporter ON rc.reporter_id = reporter.id
      LEFT JOIN profiles reporter_profile ON reporter.id = reporter_profile.user_id
      JOIN users reported ON rc.reported_user_id = reported.id
      LEFT JOIN profiles reported_profile ON reported.id = reported_profile.user_id
      LEFT JOIN users reviewer ON rc.reviewed_by = reviewer.id
      LEFT JOIN profiles reviewer_profile ON reviewer.id = reviewer_profile.user_id
      WHERE rc.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      console.log('Report not found for ID:', id);
      return res.status(404).json({ message: 'Report not found' });
    }

    console.log('Found report details for ID:', id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in getReportDetails:', err);
    res.status(500).json({ 
      message: 'Failed to get report details',
      error: err.message 
    });
  } finally {
    client.release();
  }
};

exports.updateReportStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Updating report status:', { id: req.params.id, ...req.body });
    const { id } = req.params;
    const { status, notes } = req.body;
    
    await client.query('BEGIN');

    // Update report status
    const result = await client.query(`
      UPDATE reported_content 
      SET 
        status = $1, 
        notes = $2,
        reviewed_by = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [status, notes, req.user.id, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log('Report not found for update, ID:', id);
      return res.status(404).json({ message: 'Report not found' });
    }

    // Log the action
    await client.query(`
      INSERT INTO admin_logs (admin_id, action, target_user_id, details)
      VALUES ($1, $2, $3, $4)
    `, [
      req.user.id,
      'UPDATE_REPORT_STATUS',
      result.rows[0].reported_user_id,
      `Updated report ${id} status to ${status}`
    ]);

    await client.query('COMMIT');
    console.log('Successfully updated report status:', { id, status });
    res.json({ message: 'Report status updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in updateReportStatus:', err);
    res.status(500).json({ 
      message: 'Failed to update report status',
      error: err.message 
    });
  } finally {
    client.release();
  }
}; 