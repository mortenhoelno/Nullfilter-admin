import ChatEngineTest from "../../components/ChatEngineTest";

export default function ChatTestPage() {
  return (
    <div className="h-screen flex flex-col">
      <header className="p-4 bg-gray-800 text-white font-bold">
        Testbot (SSE Prototype)
      </header>
      <main className="flex-1">
        <ChatEngineTest />
      </main>
    </div>
  );
}

// 👇 Dette trengs for å unngå build-feilen
export async function getServerSideProps() {
  return { props: {} };
}
