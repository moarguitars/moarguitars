---
layout: page
title: Gallery
description: 'Watch videos and view photos'
seo_description:
nav-menu: true
order: 3
image: 'assets/images/t-type/t-type-hollow-dark.jpg'
---

<!-- Main -->
<div id="main" class="alt">

<!-- Gallery -->
<section style="margin-top: 6em">
	<div class="inner">
		<!-- Tab links -->
		<div class="tab">
		  <button id="defaultOpen" class="tablinks" onclick="openCity(event, 'Images')">Images</button>
		  <button class="tablinks" onclick="openCity(event, 'Videos')">Videos</button>
		</div>
		<!-- Tab content -->
		<div id="Images" class="tabcontent">
		  <h2>T-Type</h2>
		<div class="row 100% uniform" style="margin-bottom: 2em">
			<div class="4u 12u$(medium)">
				<span class="image fit"><img src="../assets/images/t-type/t-type-hollow-dark-workshop.jpg" alt=""></span>
			</div>
			<div class="4u 12u$(medium)">
				<span class="image fit"><img src="../assets/images/t-type/t-type-hollow-door.jpg" alt=""></span>
			</div>
			<div class="4u$ 12u$(medium)">
				<span class="image fit"><img src="../assets/images/t-type/t-type-hollow-light-workshop.jpg" alt=""></span>
			</div>
			<div class="4u 12u$(medium)">
				<span class="image fit"><img src="../assets/images/t-type/t-type-hollow-outside.jpg" alt=""></span>
			</div>
			<div class="4u 12u$(medium)">
				<span class="image fit"><img src="../assets/images/t-type/t-type-hollow-workshop.jpg" alt=""></span>
			</div>
			<div class="4u$ 12u$(medium)">
				<span class="image fit"><img src="../assets/images/t-type/t-type-light-held.jpg" alt=""></span>
			</div>
		</div>
		<h2>Wayfair</h2>
		<div class="row 100% uniform" style="margin-bottom: 2em">
			<div class="4u 12u$(medium)">
				<span class="image fit"><img src="../assets/images/wayfair/wayfair-bigsby-held.jpg" alt=""></span>
			</div>
			<div class="4u 12u$(medium)">
				<span class="image fit"><img src="../assets/images/wayfair/wayfair-workshop-bench.jpg" alt=""></span>
			</div>
			<div class="4u$ 12u$(medium)">
				<span class="image fit"><img src="../assets/images/wayfair/wayfair-light-angled.jpg" alt=""></span>
			</div>
			<div class="4u 12u$(medium)">
				<span class="image fit"><img src="../assets/images/wayfair/wayfair-on-steps.jpg" alt=""></span>
			</div>
			<div class="4u 12u$(medium)">
				<span class="image fit"><img src="../assets/images/wayfair/wayfiar-light-outside-dull.jpg" alt=""></span>
			</div>
			<div class="4u$ 12u$(medium)">
				<span class="image fit"><img src="../assets/images/wayfair/wayfair-dark-outside-angled.jpg" alt=""></span>
			</div>
		</div>
		</div>
		<div id="Videos" class="tabcontent">
		  <h3>Videos</h3>
		  <p>Coming soon</p>
		</div>
	</div>
</section>

<!-- Scripts -->
<script>
	function openCity(evt, cityName) {
  // Declare all variables
  var i, tabcontent, tablinks;

  // Get all elements with class="tabcontent" and hide them
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(cityName).style.display = "block";
  evt.currentTarget.className += " active";
}
document.getElementById("defaultOpen").click();
</script>