export const content = {
	es: {
		brand: "BizShore Solutions SAS",
		location: "Cali, Valle del Cauca, Colombia",
		nav: {
			home: "Inicio",
			services: "Servicios",
			contact: "Contactenos",
		},
		seo: {
			home: {
				title: "Consultoria y desarrollo de software en Cali",
				description:
					"BizShore Solutions SAS ofrece consultoria en tecnologia, desarrollo a medida, mantenimiento y auditoria de software en Cali, Colombia.",
			},
			services: {
				title: "Servicios de consultoria, desarrollo y auditoria de software",
				description:
					"Conoce los servicios de BizShore Solutions SAS para evolucionar tu plataforma con calidad, seguridad y enfoque de negocio.",
			},
			contact: {
				title: "Contactenos para iniciar tu proyecto de software",
				description:
					"Habla con BizShore Solutions SAS en Cali. Atendemos de lunes a viernes para consultoria y desarrollo de software a medida.",
			},
			landing: {
				title: "Landing: diagnostico tecnico inicial",
				description:
					"Solicita un diagnostico tecnico inicial para identificar riesgos, prioridades y una ruta de mejora para tu software.",
			},
			notFound: {
				title: "Pagina no encontrada",
				description:
					"La pagina solicitada no existe. Vuelve al inicio de BizShore Solutions SAS para conocer nuestros servicios.",
			},
		},
		cta: {
			primary: "Agendar llamada",
			secondary: "Nuestros servicios",
			contact: "Escribenos",
		},
		hero: {
			badge: "Consultoria y desarrollo de software en Colombia",
			title:
				"Transformamos ideas de negocio en soluciones digitales confiables.",
			subtitle:
				"Ayudamos a empresas a disenar, construir, mantener y auditar software con foco en calidad, continuidad y resultados medibles.",
			stats: [
				{ value: "4", label: "lineas de servicio especializadas" },
				{ value: "100%", label: "enfoque en proyectos a medida" },
				{ value: "8-5", label: "atencion local de lunes a viernes" },
			],
		},
		home: {
			sectionEyebrow: "Por que elegirnos",
			sectionTitle: "Por que BizShore",
			sectionIntro:
				"Combinamos criterio de ingenieria, foco en el cliente y procesos claros para entregar software que sostiene tu operacion.",
			cards: [
				{
					title: "Acompanamiento cercano",
					description:
						"Trabajamos contigo como aliado tecnico para priorizar valor de negocio y reducir riesgos en cada entrega.",
				},
				{
					title: "Ingenieria con criterio",
					description:
						"Aplicamos buenas practicas de arquitectura, calidad y seguridad para construir soluciones sostenibles.",
				},
				{
					title: "Velocidad con calidad",
					description:
						"Equilibramos rapidez y estabilidad para que avances sin sacrificar rendimiento ni mantenibilidad.",
				},
			],
		},
		services: {
			eyebrow: "Servicios",
			title: "Servicios",
			subtitle:
				"Servicios pensados para empresas que necesitan evolucionar su software con seguridad y estrategia.",
			listEyebrow: "Catalogo",
			listTitle: "Como impulsamos tu software",
			listIntro:
				"Cuatro lineas de servicio disenadas para acompañarte desde el diagnostico hasta la entrega sostenida.",
			list: [
				{
					name: "Consultoria en tecnologia y software",
					summary:
						"Definimos hojas de ruta tecnologicas, evaluamos arquitectura actual y proponemos mejoras de alto impacto.",
					bullets: [
						"Diagnostico tecnico y funcional",
						"Roadmap de modernizacion",
						"Acompanamiento en decisiones clave",
					],
				},
				{
					name: "Desarrollo de software a medida",
					summary:
						"Construimos soluciones adaptadas a tus procesos para mejorar productividad y experiencia de usuario.",
					bullets: [
						"Aplicaciones web y APIs",
						"Integraciones con sistemas existentes",
						"Entrega incremental por fases",
					],
				},
				{
					name: "Mantenimiento de software",
					summary:
						"Mantenemos tus plataformas estables, seguras y preparadas para escalar.",
					bullets: [
						"Soporte correctivo y evolutivo",
						"Optimizacion de rendimiento",
						"Reduccion de deuda tecnica",
					],
				},
				{
					name: "Auditoria de software",
					summary:
						"Auditamos codigo, arquitectura y procesos para detectar riesgos y oportunidades de mejora.",
					bullets: [
						"Revision de calidad de codigo",
						"Evaluacion de seguridad basica",
						"Informe ejecutivo con plan de accion",
					],
				},
			],
		},
		contact: {
			eyebrow: "Hablemos",
			title: "Contactenos",
			subtitle:
				"Conversemos sobre tu necesidad. Te respondemos en horario habil y te proponemos una ruta clara de trabajo.",
			cardEyebrow: "Informacion",
			details: [
				{
					label: "Correo",
					value: "contacto@bizshore.net",
					href: "mailto:contacto@bizshore.net",
				},
				{
					label: "Telefono",
					value: "+57 3187519090",
					href: "tel:+573187519090",
				},
				{
					label: "Direccion",
					value: "Carrera 85C # 28 - 66, Cali, Valle del Cauca, Colombia",
					href: "https://maps.google.com/?q=Carrera+85C+%23+28+-+66+Cali+Valle+del+Cauca+Colombia",
				},
				{
					label: "Horario",
					value: "Lunes a viernes, 8:00 a.m. a 5:00 p.m.",
					href: null,
				},
			],
			form: {
				eyebrow: "Formulario",
				title: "Envianos un mensaje",
				intro: "Cuéntanos sobre tu proyecto y te respondemos en horario hábil.",
				name: "Nombre",
				namePlaceholder: "Tu nombre completo",
				email: "Correo",
				emailPlaceholder: "tu@correo.com",
				message: "Mensaje",
				messagePlaceholder: "Describe brevemente lo que necesitas.",
				submit: "Enviar mensaje",
				submitting: "Enviando...",
				note: "El formulario envia datos por Formspree cuando se configura el endpoint.",
				endpointMissing:
					"Falta configurar VITE_FORMSPREE_ENDPOINT. Mientras tanto, usa correo directo.",
				success: "Gracias por escribirnos. Te responderemos en horario habil.",
				error:
					"No se pudo enviar el formulario en este momento. Intenta de nuevo o usa correo directo.",
				directEmail: "Escribir por correo directo",
			},
		},
		landing: {
			eyebrow: "Landing exclusiva",
			title: "Diagnostico tecnico inicial sin costo",
			subtitle:
				"Landing independiente para campanas: evaluamos tu estado actual de software y te entregamos recomendaciones accionables.",
			bullets: [
				"Revision de arquitectura y codigo actual",
				"Mapa de riesgos y prioridades",
				"Siguiente plan de accion en 72 horas",
			],
			cta: "Solicitar diagnostico",
			disclaimer:
				"Esta pagina existe en ruta publica pero no aparece en el menu principal.",
			processEyebrow: "Proceso",
			processTitle: "Como trabajamos tu diagnostico",
			processIntro:
				"Un flujo claro y por fases para darte resultados accionables sin sacrificar tu tiempo operativo.",
			processSteps: [
				{
					title: "Reunion inicial",
					description:
						"Conversamos sobre tu plataforma, objetivos y restricciones para enmarcar el diagnostico.",
				},
				{
					title: "Analisis tecnico",
					description:
						"Revisamos codigo, arquitectura, dependencias y operaciones para mapear el estado actual.",
				},
				{
					title: "Plan de accion",
					description:
						"Entregamos un informe ejecutivo con prioridades, riesgos y una ruta recomendada a 30-90 dias.",
				},
			],
		},
		notFound: {
			eyebrow: "Error 404",
			title: "Pagina no encontrada",
			subtitle:
				"No pudimos encontrar lo que buscabas. Volvamos al inicio o exploremos los servicios disponibles.",
			primary: "Volver al inicio",
			secondary: "Ver servicios",
		},
		footer: {
			tagline:
				"Consultoria y desarrollo de software a medida en Cali, Colombia.",
			navTitle: "Navegacion",
			contactTitle: "Contacto",
			rights: "Todos los derechos reservados.",
		},
	},
	en: {
		brand: "BizShore Solutions SAS",
		location: "Cali, Valle del Cauca, Colombia",
		nav: {
			home: "Home",
			services: "Services",
			contact: "Contact",
		},
		seo: {
			home: {
				title: "Software consulting and custom development in Cali",
				description:
					"BizShore Solutions SAS provides technology consulting, custom software development, maintenance, and software audit services in Colombia.",
			},
			services: {
				title:
					"Software consulting, development, maintenance and audit services",
				description:
					"Explore BizShore Solutions SAS services to evolve your software with quality, security, and measurable business value.",
			},
			contact: {
				title: "Contact BizShore Solutions SAS",
				description:
					"Reach our team in Cali, Colombia to discuss consulting and custom software development requirements.",
			},
			landing: {
				title: "Landing: free initial technical assessment",
				description:
					"Request an initial technical assessment to identify software risks, priorities, and a clear execution path.",
			},
			notFound: {
				title: "Page not found",
				description:
					"The requested page does not exist. Return to BizShore Solutions SAS home page to explore services.",
			},
		},
		cta: {
			primary: "Schedule a call",
			secondary: "View services",
			contact: "Get in touch",
		},
		hero: {
			badge: "Technology consulting and software engineering in Colombia",
			title: "We turn business ideas into reliable digital solutions.",
			subtitle:
				"We help companies design, build, maintain, and audit software with a strong focus on quality, continuity, and measurable outcomes.",
			stats: [
				{ value: "4", label: "specialized service lines" },
				{ value: "100%", label: "custom software focus" },
				{ value: "8-5", label: "local support Monday to Friday" },
			],
		},
		home: {
			sectionEyebrow: "Why choose us",
			sectionTitle: "Why BizShore",
			sectionIntro:
				"We combine engineering judgment, customer focus, and transparent processes to ship software that holds up under real operations.",
			cards: [
				{
					title: "Close partnership",
					description:
						"We work as your technology partner to prioritize business value and reduce delivery risk.",
				},
				{
					title: "Engineering with judgment",
					description:
						"We apply architecture, quality, and security best practices to build maintainable solutions.",
				},
				{
					title: "Speed with quality",
					description:
						"We balance speed and stability so you move fast without sacrificing performance or maintainability.",
				},
			],
		},
		services: {
			eyebrow: "Services",
			title: "Services",
			subtitle:
				"Services designed for companies that need to evolve software with strategy and confidence.",
			listEyebrow: "Catalog",
			listTitle: "How we move your software forward",
			listIntro:
				"Four service lines designed to support you from initial assessment through sustained delivery.",
			list: [
				{
					name: "Technology and software consulting",
					summary:
						"We define technology roadmaps, assess current architecture, and propose high-impact improvements.",
					bullets: [
						"Technical and functional assessment",
						"Modernization roadmap",
						"Guidance for key technical decisions",
					],
				},
				{
					name: "Custom software development",
					summary:
						"We build tailored software aligned with your operations to improve productivity and user experience.",
					bullets: [
						"Web applications and APIs",
						"Integration with existing systems",
						"Incremental delivery in phases",
					],
				},
				{
					name: "Software maintenance",
					summary: "We keep your platforms stable, secure, and ready to scale.",
					bullets: [
						"Corrective and evolutionary support",
						"Performance optimization",
						"Technical debt reduction",
					],
				},
				{
					name: "Software audit",
					summary:
						"We audit code, architecture, and engineering practices to identify risks and improvement opportunities.",
					bullets: [
						"Code quality review",
						"Baseline security review",
						"Executive report with action plan",
					],
				},
			],
		},
		contact: {
			eyebrow: "Let's talk",
			title: "Contact",
			subtitle:
				"Tell us about your challenge. We reply during business hours with a clear execution approach.",
			cardEyebrow: "Information",
			details: [
				{
					label: "Email",
					value: "contacto@bizshore.net",
					href: "mailto:contacto@bizshore.net",
				},
				{ label: "Phone", value: "+57 3187519090", href: "tel:+573187519090" },
				{
					label: "Address",
					value: "Carrera 85C # 28 - 66, Cali, Valle del Cauca, Colombia",
					href: "https://maps.google.com/?q=Carrera+85C+%23+28+-+66+Cali+Valle+del+Cauca+Colombia",
				},
				{
					label: "Hours",
					value: "Monday to Friday, 8:00 a.m. to 5:00 p.m.",
					href: null,
				},
			],
			form: {
				eyebrow: "Form",
				title: "Send us a message",
				intro: "Tell us about your project and we will reply during business hours.",
				name: "Name",
				namePlaceholder: "Your full name",
				email: "Email",
				emailPlaceholder: "you@email.com",
				message: "Message",
				messagePlaceholder: "Briefly describe what you need.",
				submit: "Send message",
				submitting: "Sending...",
				note: "The form sends data through Formspree when endpoint is configured.",
				endpointMissing:
					"VITE_FORMSPREE_ENDPOINT is missing. For now, please use direct email.",
				success:
					"Thanks for reaching out. We will reply during business hours.",
				error: "Form submission failed. Please try again or use direct email.",
				directEmail: "Send direct email",
			},
		},
		landing: {
			eyebrow: "Featured landing",
			title: "Free initial technical assessment",
			subtitle:
				"Independent campaign landing page: we evaluate your software landscape and deliver actionable recommendations.",
			bullets: [
				"Architecture and code baseline review",
				"Risk and priority map",
				"Action plan proposal in 72 hours",
			],
			cta: "Request assessment",
			disclaimer:
				"This page is publicly available by URL path but hidden from the main navigation menu.",
			processEyebrow: "Process",
			processTitle: "How we run the assessment",
			processIntro:
				"A clear, phased workflow that delivers actionable insight without disrupting your operations.",
			processSteps: [
				{
					title: "Kickoff call",
					description:
						"We align on your platform, goals, and constraints to frame the assessment.",
				},
				{
					title: "Technical analysis",
					description:
						"We review code, architecture, dependencies, and operations to map the current state.",
				},
				{
					title: "Action plan",
					description:
						"You receive an executive report with priorities, risks, and a 30-90 day roadmap.",
				},
			],
		},
		notFound: {
			eyebrow: "Error 404",
			title: "Page not found",
			subtitle:
				"We could not find what you were looking for. Head back home or browse our services.",
			primary: "Back to home",
			secondary: "See services",
		},
		footer: {
			tagline:
				"Software consulting and custom development based in Cali, Colombia.",
			navTitle: "Navigation",
			contactTitle: "Contact",
			rights: "All rights reserved.",
		},
	},
};
