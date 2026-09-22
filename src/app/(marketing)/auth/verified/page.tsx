export default function VerifiedPage() {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Email Verified</h1>
        <p className="text-gray-600 leading-relaxed mb-8">Your email has been confirmed. You can now log in to your DataVerse AI account.</p>
        <a href="/login" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition">Go to Login</a>
      </main>
    );
  }