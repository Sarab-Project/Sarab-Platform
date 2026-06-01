import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { DatabaseView } from './components/DatabaseView';
import { SampleDetail } from './pages/SampleDetail';
import { EditSample } from './pages/EditSample';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { UploadSample } from './pages/UploadSample';
import { MyUploads } from './pages/MyUploads';
import { AdminDashboard } from './pages/AdminDashboard';
import { Profile } from './pages/Profile';
import { About } from './pages/About';
import { Groups } from './pages/Groups';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: () => (
        <ProtectedRoute>
          <DatabaseView />
        </ProtectedRoute>
      ) },
      { path: 'sample/:id', Component: () => (
        <ProtectedRoute>
          <SampleDetail />
        </ProtectedRoute>
      ) },
      { path: 'sample/:id/edit', Component: () => (
        <ProtectedRoute>
          <EditSample />
        </ProtectedRoute>
      ) },
      { path: 'upload', Component: () => (
        <ProtectedRoute>
          <UploadSample />
        </ProtectedRoute>
      ) },
      { path: 'my-uploads', Component: () => (
        <ProtectedRoute>
          <MyUploads />
        </ProtectedRoute>
      ) },
      { path: 'admin', Component: () => (
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      ) },
      { path: 'profile', Component: () => (
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      ) },
      { path: 'about', Component: () => (
        <ProtectedRoute>
          <About />
        </ProtectedRoute>
      ) },
      { path: 'signin', Component: () => (
        <GuestRoute>
          <SignIn />
        </GuestRoute>
      ) },
      { path: 'signup', Component: () => (
        <GuestRoute>
          <SignUp />
        </GuestRoute>
      ) },
      { path: 'groups', Component: () => (
        <ProtectedRoute>
          <Groups />
        </ProtectedRoute>
      ) },
    ],
  },
]);
