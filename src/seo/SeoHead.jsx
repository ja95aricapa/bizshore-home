import { usePageSeo } from "../hooks/usePageSeo";

function SeoHead({ meta }) {
	usePageSeo(meta);
	return null;
}

export default SeoHead;
