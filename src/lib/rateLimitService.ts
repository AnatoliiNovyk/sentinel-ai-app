import { supabase, ApiRateLimit, ApiUsage, DEFAULT_RATE_LIMITS } from './supabase';

export async function getRateLimitConfig(planId: string): Promise<ApiRateLimit> {
  return DEFAULT_RATE_LIMITS[planId] || DEFAULT_RATE_LIMITS.free;
}

export async function getCurrentUsage(userId: string, metric: keyof ApiRateLimit): Promise<number> {
  const now = new Date();
  const resetDate = new Date(now);

  // Determine reset period based on metric
  if (metric === 'scans_per_month') {
    // Monthly: reset on 1st of next month
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
  } else if (metric === 'reports_per_day') {
    // Daily: reset tomorrow at midnight
    resetDate.setDate(resetDate.getDate() + 1);
    resetDate.setHours(0, 0, 0, 0);
  } else if (metric === 'chat_messages_per_hour') {
    // Hourly: reset next hour
    resetDate.setHours(resetDate.getHours() + 1);
    resetDate.setMinutes(0, 0, 0);
  } else if (metric === 'api_calls_per_second') {
    // Per-second: reset in 1 second
    resetDate.setSeconds(resetDate.getSeconds() + 1);
  }

  const { data, error } = await supabase
    .from('api_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('metric', metric)
    .gt('reset_at', now.toISOString())
    .maybeSingle();

  if (error) {
    console.error('Error fetching usage:', error);
    return 0;
  }

  return data?.count ?? 0;
}

export async function recordUsage(userId: string, metric: keyof ApiRateLimit): Promise<boolean> {
  const now = new Date();
  const resetDate = new Date(now);

  // Calculate reset time based on metric
  if (metric === 'scans_per_month') {
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
  } else if (metric === 'reports_per_day') {
    resetDate.setDate(resetDate.getDate() + 1);
    resetDate.setHours(0, 0, 0, 0);
  } else if (metric === 'chat_messages_per_hour') {
    resetDate.setHours(resetDate.getHours() + 1);
    resetDate.setMinutes(0, 0, 0);
  } else if (metric === 'api_calls_per_second') {
    resetDate.setSeconds(resetDate.getSeconds() + 1);
  }

  // Get or create usage record
  const { data: existing } = await supabase
    .from('api_usage')
    .select('id, count')
    .eq('user_id', userId)
    .eq('metric', metric)
    .gt('reset_at', now.toISOString())
    .maybeSingle();

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('api_usage')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id);

    return !error;
  } else {
    // Create new record
    const { error } = await supabase
      .from('api_usage')
      .insert({
        user_id: userId,
        metric,
        count: 1,
        reset_at: resetDate.toISOString(),
      });

    return !error;
  }
}

export async function checkRateLimit(
  userId: string,
  planId: string,
  metric: keyof ApiRateLimit
): Promise<{ allowed: boolean; remaining: number; limit: number; resetAt: string }> {
  const limits = await getRateLimitConfig(planId);
  const limit = limits[metric];
  const current = await getCurrentUsage(userId, metric);
  const remaining = Math.max(0, limit - current);

  // Calculate reset time
  const now = new Date();
  const resetDate = new Date(now);

  if (metric === 'scans_per_month') {
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
  } else if (metric === 'reports_per_day') {
    resetDate.setDate(resetDate.getDate() + 1);
    resetDate.setHours(0, 0, 0, 0);
  } else if (metric === 'chat_messages_per_hour') {
    resetDate.setHours(resetDate.getHours() + 1);
    resetDate.setMinutes(0, 0, 0);
  } else if (metric === 'api_calls_per_second') {
    resetDate.setSeconds(resetDate.getSeconds() + 1);
  }

  return {
    allowed: current < limit,
    remaining,
    limit,
    resetAt: resetDate.toISOString(),
  };
}
