<!-- src/routes/+page.svelte -->

<script lang="ts">
	import type { PageServerData } from './$types';

	export let data: PageServerData;
</script>

<div class="container">
	<h1>Markdown Blog</h1>

	<ul class="links">
		{#each data.posts as post}
			<li>
				<a href={`blog/${post.slug}`}>{post.title}</a>
			</li>
		{/each}
	</ul>

	<ul class="links">
		{#each data.postDates as postDate}
			<li>
				<p>{postDate.day}</p>
				<p>{postDate.month}</p>
				<p>{postDate.year}</p>
			</li>
		{/each}
	</ul>
</div>

<style lang="scss">
	.container {
		width: 60%;
		margin: 1.25rem auto;
		text-align: center;

		h1 {
			font-size: 1.5rem;
			line-height: 2rem;
			font-weight: 600;
			color: #ffffff;
			padding: 1rem;
			border-radius: 0.25rem;
			background-color: #2563eb;
		}

		.links {
			margin: 0.625rem 0;
			padding: 0;
			list-style-type: none;

			a {
				text-decoration-line: underline;
				color: #2563eb;
				font-size: 1.25rem;
				line-height: 1.75rem;
				:hover {
					color: #1e40af;
				}
			}
		}
	}
</style>
