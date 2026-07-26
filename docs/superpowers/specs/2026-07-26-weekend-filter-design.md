# Weekend-Only Filter Design

Add a keyboard-accessible “Weekends only” checkbox to the existing filter rail. When enabled, results include Saturday and Sunday slots only; date, time, and search filters continue composing with it. The Clear action unchecks it. Date evaluation uses explicit calendar components so behavior is timezone-stable. Scraping, cached data, sport tabs, and reservation links remain unchanged.

Verification covers Saturday/Sunday acceptance, weekday rejection, checkbox wiring, Clear behavior, responsive styling, and the existing dashboard contract.

