import { supabaseAdmin, authenticateRequest, parseJsonBody } from './supabaseAdmin.js';

export default async function handler(req, res) {
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const userId = auth.user.id;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('footprints')
      .select('id,city,date,year,lat,lng,note,image')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data ?? []);
  }

  if (req.method === 'POST') {
    const body = await parseJsonBody(req);
    const payload = {
      user_id: userId,
      id: body.id,
      city: body.city,
      date: body.date,
      year: body.year,
      lat: body.lat,
      lng: body.lng,
      note: body.note,
      image: body.image,
      created_at: new Date().toISOString(),
    };

    const requiredFields = ['id', 'city', 'date', 'year', 'lat', 'lng'];
    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        return res.status(400).json({ error: `Missing field: ${field}` });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('footprints')
      .insert(payload)
      .select('id,city,date,year,lat,lng,note,image')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
