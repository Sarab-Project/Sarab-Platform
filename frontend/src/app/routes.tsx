import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { DatabaseView } from './components/DatabaseView';
import { SampleDetail } from './pages/SampleDetail';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { UploadSample } from './pages/UploadSample';
import { MyUploads } from './pages/MyUploads';
import { AdminDashboard } from './pages/AdminDashboard';
import { Profile } from './pages/Profile';
import { About } from './pages/About';
import { Groups } from './pages/Groups';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: DatabaseView },
      { path: 'sample/:id', Component: SampleDetail },
      { path: 'upload', Component: UploadSample },
      { path: 'my-uploads', Component: MyUploads },
      { path: 'admin', Component: AdminDashboard },
      { path: 'profile', Component: Profile },
      { path: 'about', Component: About },
      { path: 'signin', Component: SignIn },
      { path: 'signup', Component: SignUp },
      { path: 'groups', Component: Groups },
    ],
  },
]);
