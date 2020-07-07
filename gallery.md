---
layout: page
title: Gallery
description: 'Watch videos and view photos'
seo_description:
nav-menu: true
order: 4
image: 'assets/images/t-type/t-type-hollow-dark.jpg'
---

<!-- Main -->
<div id="main" class="alt">

<!-- Gallery -->
<section style="margin-top: 6em">
	<div class="inner">
		<div class="row 100% insta-gallery">
			{% for record in site.data.instagram.records reversed %}
			{% if record.fields.type == 'IMAGE' and 'CAROUSEL_ALBUM' %}
			<div class="4u 12u$(medium)">
				{% if record.fields.image %}
				<img class="image fit" src="{{ record.fields.image }}" alt="">
				{% else %}
				<img class="image fit" src="{{ record.fields.upload[0].url }}" alt="">
				{% endif %}
				<p>{{ record.fields.caption }}</p>
			</div>
			{% endif %}
			{% endfor %}
		</div>
	</div>
</section>

</div>