
import { supabase } from './src/lib/supabase';

async function checkColumns() {
  const { data, error } = await supabase.from('order_items').select('*').limit(1);
  if (error) {
    console.error('Error fetching order_items:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in order_items:', Object.keys(data[0]));
  } else {
    console.log('No data in order_items');
  }
}

checkColumns();
