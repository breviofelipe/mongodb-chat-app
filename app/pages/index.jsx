
import Chat from '@/components/Chat'

export default function Home() {
  return (
    <main>
      <Chat wsUrl="ws://localhost:3001" />
      {/* Altere para wss://seu-app.herokuapp.com em produção */}
    </main>
  );
}
