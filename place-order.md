---
layout: page
title: Place Order Request
show_tile: false
nav-menu: false
---

<!-- Main -->
<div id="main" class="alt">



<!-- Intro -->
<section>
	<div class="inner">
		<section style="margin-top: 6em">
			<h2>Place Order Request</h2>
			<p>So you’ve gone through my site and have come to the excellent decision that you want to order a guitar. First off thanks! That’s brilliant news, welcome to the family! To commit you and I to the build, and to get onto my waiting list - once you place this request, you will be asked to pay for your deposit via PayPal. The waiting list is currently about 4 months from me receiving the deposit to you receiving your guitar.</p> 
			<p>I am also still very much a custom shop, and love taking on one of a kind, custom orders. Want a hollow flying V, a fretless baritone RD, a headless, midi connected bass, I am fresh! Just <a href="{{ 'contact' | relative_url }}">send me a mail</a> and we can chat.</p>
			<!-- <script type="text/javascript">window.onload = function(){location.href=document.getElementById("selectbox").value;}
			</script> -->
			<form action="https://liveformhq.com/form/0a425dcc-82fa-4f2d-b1aa-7495349eedbc" method="post">
				<div class="field half first" style="margin-bottom: 0.4em">
					<label for="name">Name</label>
					<input type="text" name="name" id="name" />
				</div>
				<div class="field half" style="margin-bottom: 0.4em">
					<label for="email">Email</label>
					<input type="text" name="_replyto" id="email" />
				</div>
				<p style="font-size:0.6em">We capture your name and email at this point in case we need to contact you directly about your order. You will not be signed up to any mailing lists.</p>
				<div class="field">
					<label for="guitarmodel">Model</label>
					<select name="guitarmodel" id="guitarmodel">
						<option value="{{ 'checkout/solid-t' | relative_url}}">Solid Morty (500USD Deposit)</option>
						<option value="{{ 'checkout/hollow-t' | relative_url}}">Hollow Morty (600USD Deposit)</option>
						<option value="{{ 'checkout/offset' | relative_url}}">Moar Offset (700USD Deposit)</option>
						<option value="{{ 'checkout/solid-bass' | relative_url}}">Solid Bass (700USD Deposit)</option>
						<option value="{{ 'checkout/hollow-bass' | relative_url}}">Hollow Bass (800USD Deposit)</option>
						<option value="{{ 'checkout/wayfair' | relative_url}}">Wayfair (1000USD Deposit)</option>
					</select>
				</div>
				<!-- <input type="hidden" name="_nodirect" /> -->
				<ul class="actions">
					<li><input type="submit" value="Continue to Pay" class="special" onClick="window.open(guitarmodel.value,'newtab')"/></li>
					<li><input type="reset" value="Clear" /></li>
				</ul>
			</form>	
		</section>
	</div>
</section>

