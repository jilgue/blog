import relativeImages from "mdsvex-relative-images";

const config = {
	extensions: ['.svx', '.md'],
	smartypants: {
		dashes: 'oldschool'
	},
	remarkPlugins: [relativeImages]
};

export default config;
