import { LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function UserMenu() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {user?.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt="Avatar"
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <User className="w-8 h-8 text-gray-500" />
        )}
        <span className="text-sm text-gray-700">
          {user?.user_metadata?.full_name || user?.email}
        </span>
      </div>
      <button
        onClick={signOut}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
        title="ログアウト"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}
