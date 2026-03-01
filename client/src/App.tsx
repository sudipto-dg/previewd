import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import FolderBrowser from "./components/FolderBrowser.tsx";
import Login from "./components/Login.tsx";

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const token = localStorage.getItem("token");
    return token ? children : <Navigate to="/login" replace />;
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <FolderBrowser />
                        </PrivateRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
