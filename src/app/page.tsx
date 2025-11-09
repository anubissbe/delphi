import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Chat - Delphi's Oracle",
  description: "Chat with the internet, chat with Delphi's Oracle.",
};

const Home = () => {
  return <ChatWindow />;
};

export default Home;
