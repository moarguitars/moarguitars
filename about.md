---
layout: page
title: ABOUT
description: 'Find out moar'
image: 'assets/images/default--wayfair.png'
seo_description:
nav-menu: true
---

<!-- Main -->
<div id="main" class="alt">

<!-- Intro -->
<section id="intro" style="margin-top:2em;">
	<div class="inner">
		<h1>{{ page.title }}</h1>
    <h4>{{ page.description }}</h4>
		<p>We aim to bring you new and exciting drama from our inhouse Printers Playhouse theatre company, visiting theatre companies, and our Community and Youth Theatre groups. If you are seeking the best in new theatre in Eastbourne, The Playhouse is the place to go!</p>
	</div>
  <div class="row 100% uniform">
    <div class="4u 12u$(medium)">
      <img style="padding:0; width: 100%;" src="/assets/images/theatre--children-acting-period-drama.jpg" />
    </div>
    <div class="4u 12u$(medium)">
      <img style="padding:0; width: 100%;" src="/assets/images/theatre--group-of-players.jpg" />
    </div>
    <div class="4u 12u$(medium)">
      <img style="padding:0; width: 100%;" src="/assets/images/theatre--group-rehearsing.jpg" />
    </div>
  </div>
  <div class="inner">
    <h2>Direct Address</h2>
    <p>A chance for performers to work on and perform monologues and songs to industry standard. 8 actors with 3 two minute pieces working with PPH professional directors to culminate in a showcase performance.</p>
    <p>8 actors. 3, 2 min monologues combining for an hour long performance in the Playhouse.</p>
    <p>Every third Friday of every other month!</p>
    <p>We are already building a great network of artists and musicians locally and nationally, but are always on the lookout for new talent to showcase; either downstairs or in joint promotions upstairs in the theatre. Let us know about you by emailing chris@printersplayhouse.co.uk – and it could be the beginning of a glittering career, or at least a lovely gig at Printers Playhouse!</p>
  </div>
</section>

<!-- About -->	
{% if site.categories.theatre %}
<div class="innersmall">
	<h2 style="text-transform: capitalize;">Upcoming Shows</h2>
</div>
{% endif %}
<section id="two" class="tiles">
  {% for post in site.categories.theatre reversed %}
  {% if site.tiles-source == 'posts' and post.archived != true %}
  <article>
    <span class="image">
      <img src="{{ post.image }}" alt="{{ post.image-alt }}" />
    </span>
    <header>
      <h3><a href="{{ post.url  | relative_url }}" class="link">{{ post.title }}</a></h3>
      <h4>{{ post.date | date: "%a, %b %d, %y" }}</h4>
    </header>
  </article>
  {% endif %}
  {% endfor %}
</section>
