// Read-only JSON endpoint for the AgencyHQ agent (legacy/fallback compatibility).
// The agent normally reads Supabase directly, but this lets you point
// settings.social_calendar.url here too. Uses the anon key (RLS applies).
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  const { data, error } = await supabase.from('posts').select('*').order('post_date')
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json(data)
}
