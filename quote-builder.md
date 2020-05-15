---
price: 1500
---

<!-- Main -->
<div id="main" class="alt">
<section>
	<div class="inner row" id="extra-features">
		<div class="12u 12u(small)">
			<h1>Quote Builder</h1>
		</div>
		<div class="6u 12u(small)">
			<h3>Guitar Info</h3>
			<p>Guitar information</p>
		</div>
		<div class="6u 12u(small) box">
			<h3>Your Guitar</h3>
			<div>
				<table>
					<tbody>
						<tr>
							<td width="80%">
								<p>Total</p>
							</td>
							<td width="20%">
								$<span id="payment-total">{{page.price}}</span>
							</td>
						</tr>
			        </tbody>
			    </table>
			</div>
			<h4>Hardware Spec</h4>
			<!-- Binding -->
			<button class="accordion" id="btn-binding">Binding</button>
			<div class="panel" id="binding">
				<div class="100% row">
				  	<table class="alt">
						<tbody>
							<tr> 
								<th width="70%">Item</th>
				    			<th width="30%">$USD</th>
				    		</tr>
				    		<tr>
				    			<td>
				    				<input class="binding" value="160" type="checkbox" id="Checkbox1" data-toggle="checkbox"> 
				    				<label class="checkbox" for="Checkbox1">Top binding</label>
				    			</td>
				    			<td>
				    				<p>160</p>
				    			</td>
				    		</tr>
				    		<tr>
				    			<td>
				    				<input class="binding" value="160"  type="checkbox" id="Checkbox2" data-toggle="checkbox"> 
									<label class="checkbox" for="Checkbox2">Bottom binding</label>
								</td>
								<td>
									<p>160</p>
								</td>
							</tr>
							<tr>
				    			<td>
				    				<input class="binding" value="160"  type="checkbox" id="Checkbox3" data-toggle="checkbox"> 
									<label class="checkbox" for="Checkbox3">F-hole binding</label>
								</td>
								<td>
									<p>160</p>
								</td>
							</tr>
							<tr>
				    			<td>
				    				<input class="binding" value="220"  type="checkbox" id="Checkbox4" data-toggle="checkbox"> 
									<label class="checkbox" for="Checkbox4">Neck binding</label>
								</td>
								<td>
									<p>220</p>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
			<!-- Hardware -->
			<button class="accordion">Hardware</button>
			<div class="panel">
			  <table class="alt">
					<tbody>
						<tr> 
							<th width="70%">Item</th>
			    			<th width="30%">$USD</th>
			    		</tr>
						<tr>
							<td>
								<input value="45" type="checkbox" id="hardware1" data-toggle="checkbox" name="Gold Hardware and frets"> 
			    				<label class="checkbox" for="hardware1">Gold Hardware and frets</label>
							</td>
							<td>45</td>
						</tr>
						<tr>
							<td>
								<input value="20" type="checkbox" id="hardware2" data-toggle="checkbox" name="Locking tuners over standard"> 
			    				<label class="checkbox" for="hardware2">Locking tuners over standard</label>
							</td>
							<td>20</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>


		<!-- Form Script -->
		<script>
		function updateTotals() {
		    var inputs = document.getElementById('extra-features').getElementsByTagName('input');
		        
		    var sum = {{ page.price }};
		    for (var i = 0, num = inputs.length; i < num; i++) {
		        if (inputs[i].checked) {
		            sum += parseInt(inputs[i].getAttribute('value'));
		        }
		    }

		    document.getElementById('payment-total').innerHTML = sum;
		    
		}
		var section = document.getElementById('extra-features');
		var inputs = section.getElementsByTagName('input');
		for (var i = 0, num = inputs.length; i < num; i++) {
		    inputs[i].addEventListener('change', updateTotals);
		}
		</script>

		<!-- Accordian Script -->
		<script>
		var acc = document.getElementsByClassName("accordion");
		var i;

		for (i = 0; i < acc.length; i++) {
		  acc[i].addEventListener("click", function() {
		    /* Toggle between adding and removing the "active" class,
		    to highlight the button that controls the panel */
		    this.classList.toggle("active");

		    /* Toggle between hiding and showing the active panel */
		    var panel = this.nextElementSibling;
		    if (panel.style.display === "block") {
		      panel.style.display = "none";
		    } else {
		      panel.style.display = "block";
		    }
		  });
		}

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
		</script>
	</div>
</section>
</div>