import { NavLink, Outlet } from "react-router-dom";
import { routes } from "../config/routes";

function SiteLayout({ lang, setLang, copy }) {
	return (
		<div className='site-shell'>
			<header className='site-header'>
				<div className='brand-wrap'>
					<p className='eyebrow'>{copy.location}</p>
					<NavLink className='brand' to={routes.home}>
						{copy.brand}
					</NavLink>
				</div>

				<div className='header-actions'>
					<nav aria-label='Principal'>
						<ul className='menu'>
							<li>
								<NavLink to={routes.home} end>
									{copy.nav.home}
								</NavLink>
							</li>
							<li>
								<NavLink to={routes.services}>{copy.nav.services}</NavLink>
							</li>
							<li>
								<NavLink to={routes.contact}>{copy.nav.contact}</NavLink>
							</li>
						</ul>
					</nav>

					<button
						type='button'
						className='lang-toggle'
						onClick={() => setLang(lang === "es" ? "en" : "es")}
						aria-label='Cambiar idioma / Change language'
					>
						{lang === "es" ? "EN" : "ES"}
					</button>
				</div>
			</header>

			<main>
				<Outlet />
			</main>

			<footer className='site-footer'>
				<p>{copy.footer}</p>
			</footer>
		</div>
	);
}

export default SiteLayout;
