import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import router from '@/router';

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#11131c',
            color: '#f3f4f6',
            border: '1px solid #1e293b',
          },
        }}
      />
    </>
  );
}

export default App;
