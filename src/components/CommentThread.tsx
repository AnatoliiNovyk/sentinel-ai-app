import { useState, useEffect } from 'react';
import { MessageCircle, Send, Trash2, Edit2, X, Clock } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { FindingComment } from '../lib/supabase';
import { getComments, addComment, updateComment, deleteComment, subscribeToComments } from '../lib/commentService';

function timeAgo(iso: string) {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(delta / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

interface CommentThreadProps {
  vulnerabilityId: string;
  vulnerabilityTitle: string;
}

export function CommentThread({ vulnerabilityId, vulnerabilityTitle }: CommentThreadProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<FindingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Fetch comments on mount and subscribe to updates
  useEffect(() => {
    setLoading(true);
    getComments(vulnerabilityId).then(setComments).finally(() => setLoading(false));

    const unsubscribe = subscribeToComments(vulnerabilityId, setComments);
    return unsubscribe;
  }, [vulnerabilityId]);

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;

    await addComment(vulnerabilityId, user.id, newComment, replyTo || undefined);
    setNewComment('');
    setReplyTo(null);

    // Refetch comments
    const updated = await getComments(vulnerabilityId);
    setComments(updated);
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editText.trim()) return;

    await updateComment(commentId, editText);
    setEditingId(null);

    const updated = await getComments(vulnerabilityId);
    setComments(updated);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    await deleteComment(commentId);
    const updated = await getComments(vulnerabilityId);
    setComments(updated);
  };

  const commentCount = comments.length + comments.reduce((acc, c) => acc + (c.replies?.length || 0), 0);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="Open comments"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 text-slate-300 text-xs transition"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Comments
        {commentCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">{commentCount}</span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Comments</h3>
            {commentCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">{commentCount}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate max-w-[240px]" title={vulnerabilityTitle}>{vulnerabilityTitle}</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          title="Close comments"
          className="p-1 hover:bg-slate-800 rounded-md transition"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-sm text-slate-400">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-sm text-slate-400">No comments yet. Start a discussion!</div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              {/* Main Comment */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-slate-400">
                    <span className="text-emerald-400 font-semibold">User {comment.user_id.slice(0, 6)}</span>
                    {' '}
                    <span className="inline-flex items-center gap-0.5 text-slate-600"><Clock className="w-2.5 h-2.5" />{timeAgo(comment.created_at)}</span>
                  </div>
                  {user?.id === comment.user_id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditText(comment.content);
                        }}
                        title="Edit comment"
                        className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        title="Delete comment"
                        className="p-0.5 hover:bg-red-900/20 rounded text-slate-400 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="mt-2 space-y-2">
                    <label htmlFor={`edit-${comment.id}`} className="text-xs text-slate-400">Edit comment</label>
                    <textarea
                      id={`edit-${comment.id}`}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      rows={2}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdateComment(comment.id)}
                        title="Save comment"
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold px-2 py-1 rounded transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        title="Cancel edit"
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-200 mt-2">{comment.content}</p>
                    <button
                      onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                      title={replyTo === comment.id ? "Cancel reply" : "Reply to comment"}
                      className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 transition"
                    >
                      {replyTo === comment.id ? 'Cancel reply' : 'Reply'}
                    </button>
                  </>
                )}
              </div>

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-4 space-y-2 border-l-2 border-slate-700 pl-3">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="bg-slate-900/30 rounded-lg p-2">
                      <div className="text-xs text-slate-500 mb-1">
                        <span className="text-sky-400 font-semibold">User {reply.user_id.slice(0, 6)}</span>
                      </div>
                      <p className="text-xs text-slate-300">{reply.content}</p>
                      {user?.id === reply.user_id && (
                        <button
                          onClick={() => handleDeleteComment(reply.id)}
                          title="Delete reply"
                          className="mt-1 p-0.5 hover:bg-red-900/20 rounded text-slate-500 hover:text-red-400 text-xs transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-800 p-3 space-y-2">
        {replyTo && (
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Replying to comment...</span>
            <button 
              onClick={() => setReplyTo(null)} 
              title="Cancel reply"
              className="text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <label htmlFor="comment-input" className="sr-only">Add a comment</label>
          <input
            id="comment-input"
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim() || !user}
            title="Send comment"
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 p-1.5 rounded transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
