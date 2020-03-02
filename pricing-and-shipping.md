---
layout: page
title: Pricing & Shipping
description: 'More information about pricing and shipping'
seo_description:
show_tile: false
nav-menu: false
---

<!-- Main -->
<div id="main" class="alt">



<!-- Intro -->
<section id="contact">
	<div class="inner">
		<section>
			<h2 style="text-transform: uppercase;">Contact Us</h2>
			<p>If you have a question or would like to find out more about owning one of our custom-built guitars, please use the form below to get in touch.</p> 
			<form action="https://formspree.io/{{ site.email }}" method="POST">
				<div class="field half first">
					<label for="name">Name</label>
					<input type="text" name="name" id="name" />
				</div>
				<div class="field half">
					<label for="email">Email</label>
					<input type="text" name="_replyto" id="email" />
				</div>
				<div class="field">
					<label for="message">Message</label>
					<textarea name="message" id="message" rows="6"></textarea>
				</div>
				<ul class="actions">
					<li><input type="submit" value="Send Message" class="special" /></li>
					<li><input type="reset" value="Clear" /></li>
				</ul>
			</form>
		</section>
		<section class="split">
			<section>
				<div class="contact-method">
					<span class="icon alt fa-envelope"></span>
					<h3>Email</h3>
					<a href="">{{ site.email }}</a>
				</div>
			</section>
			<section>
				<div class="contact-method">
					<span class="icon alt fa-instagram"></span>
					<h3>Instagram</h3>
					<a href="{{ site.instagram_url }}">@moarguitars</a>
				</div>
			</section>
			<section>
				<div class="contact-method">
					<span class="icon alt fa-facebook"></span>
					<h3>Facebook</h3>
					<a href="{{ site.facebook_url }}">@moarguitars</a>
				</div>
			</section>
		</section>
	</div>
</section>

