import { supabase, FindingComment } from './supabase';

export async function getComments(vulnerabilityId: string): Promise<FindingComment[]> {
  const { data, error } = await supabase
    .from('finding_comments')
    .select('*')
    .eq('vulnerability_id', vulnerabilityId)
    .is('replies', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    return [];
  }

  // Fetch replies for each comment
  const commentsWithReplies = await Promise.all(
    (data || []).map(async (comment) => {
      const { data: replies } = await supabase
        .from('finding_comments')
        .select('*')
        .eq('vulnerability_id', vulnerabilityId)
        .eq('parent_id', comment.id)
        .order('created_at', { ascending: true });

      return { ...comment, replies: replies || [] };
    })
  );

  return commentsWithReplies;
}

export async function addComment(
  vulnerabilityId: string,
  userId: string,
  content: string,
  parentId?: string
): Promise<FindingComment | null> {
  const { data, error } = await supabase
    .from('finding_comments')
    .insert({
      vulnerability_id: vulnerabilityId,
      user_id: userId,
      content,
      parent_id: parentId || null,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error adding comment:', error);
    return null;
  }

  return data;
}

export async function updateComment(
  commentId: string,
  content: string
): Promise<FindingComment | null> {
  const { data, error } = await supabase
    .from('finding_comments')
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating comment:', error);
    return null;
  }

  return data;
}

export async function deleteComment(commentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('finding_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    console.error('Error deleting comment:', error);
    return false;
  }

  return true;
}

// Subscribe to real-time comment updates
export function subscribeToComments(
  vulnerabilityId: string,
  callback: (comments: FindingComment[]) => void
) {
  const subscription = supabase
    .channel(`finding_comments:vulnerability_id=eq.${vulnerabilityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'finding_comments' }, () => {
      // Refetch comments when any change occurs
      getComments(vulnerabilityId).then(callback);
    })
    .subscribe();

  return () => subscription.unsubscribe();
}
