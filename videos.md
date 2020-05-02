---
layout: page
title: Videos
description: 
seo_description:
nav-menu: true
order: 4
---

<!-- Main -->
<div id="main" class="alt">

<!-- Gallery -->
<section style="margin-top: 6em">
	<div class="inner">
	  <h3>Latest Videos</h3>
	  <div class="row 100% insta-gallery" style="margin-bottom: 2em">
		{% for record in site.data.youtube.records reversed %}
		<div class="6u 12u$(medium)">
			<a style="text-decoration:none;" href="{{ record.fields.video }}" target="_blank">
				<img class="image fit" src="{{ record.fields.thumbnail }}" alt="">
			</a>
			<h4>{{ record.fields.title }}</h4>
			<p>{{ record.fields.description | markdownify }}</p>
		</div>
		{% endfor %}
		</div>
	</div>
</section>
