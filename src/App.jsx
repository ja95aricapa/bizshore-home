import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./components/SiteLayout";
import { routes } from "./config/routes";
import { content } from "./content/siteContent";
import ContactPage from "./pages/ContactPage";
import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import ServicesPage from "./pages/ServicesPage";

function App() {
	const [lang, setLang] = useState("es");
	const copy = useMemo(() => content[lang], [lang]);

	return (
		<Routes>
			<Route element={<SiteLayout lang={lang} setLang={setLang} copy={copy} />}>
				<Route
					path={routes.home}
					element={<HomePage copy={copy} lang={lang} />}
				/>
				<Route
					path={routes.homeAlias}
					element={<Navigate to={routes.home} replace />}
				/>
				<Route
					path={routes.services}
					element={<ServicesPage copy={copy} lang={lang} />}
				/>
				<Route
					path={routes.contact}
					element={<ContactPage copy={copy} lang={lang} />}
				/>
				<Route
					path={routes.landing}
					element={<LandingPage copy={copy} lang={lang} />}
				/>
				<Route path='*' element={<NotFoundPage copy={copy} lang={lang} />} />
			</Route>
		</Routes>
	);
}

export default App;
