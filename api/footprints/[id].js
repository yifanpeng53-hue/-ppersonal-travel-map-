import { supabaseAdmin, authenticateRequest, parseJsonBody } from '../supabaseAdmin.js';

export default async function handler(req, res) {
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const userId = auth.user.id;
  const id = req.query?.id;
  if (!id) {
    return res.status(400).json({ error: 'Missing footprint id' });
  }

  if (req.method === 'PUT') {
    const body = await parseJsonBody(req);
    const updates = {};
    const allowedFields = ['city', 'date', 'year', 'lat', 'lng', 'note', 'image'];
    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('footprints')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id,city,date,year,lat,lng,note,image')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { data, error } = await supabaseAdmin
      .from('footprints')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
