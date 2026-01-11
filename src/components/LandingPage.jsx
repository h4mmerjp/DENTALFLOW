import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* ヘッダー */}
      <header className="px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">DentalFlow</h1>
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                       transition-colors disabled:opacity-50"
          >
            ログイン
          </button>
        </div>
      </header>

      {/* ヒーローセクション */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            歯科治療ワークフロー管理
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            患者の治療計画を効率的に管理。<br />
            ドラッグ&ドロップでスケジュール調整。
          </p>
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="inline-flex items-center gap-3 px-6 py-3
                       bg-white border border-gray-300 rounded-lg shadow-sm
                       hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-gray-700 font-medium">Googleでログイン</span>
          </button>
        </div>

        {/* 機能紹介 */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🦷</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">歯牙図管理</h3>
            <p className="text-gray-600">視覚的に歯の状態を記録</p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">治療計画</h3>
            <p className="text-gray-600">自動でワークフロー生成</p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📅</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">スケジュール</h3>
            <p className="text-gray-600">ドラッグ&ドロップで調整</p>
          </div>
        </div>
      </main>
    </div>
  );
}
