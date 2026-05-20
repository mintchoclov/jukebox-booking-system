MILESTONE I README

Team Name 
JIWAScript
Proposed Level of Achievement
Apollo 11
Motivation 
JukeBox is one of the interest groups in Ridge View Residential College (RVRC), with over 66 active members and multiple bands. Currently, the logistics head manages all music room (MR) bookings manually by hosting bidding rounds, resolving ties, and entering the final schedule into a shared Google Calendar. After band bookings are finalised, individual members must request self-practice slots through messaging, with confirmations only arriving once messages are seen.
We spoke with the JukeBox logistics head to know exactly where the current process falls short. Firstly, band bidding is currently done via Google Sheets dropdowns, with results manually tabulated and pushed to Google Calendar by the admin. Individual self-practice bookings are made by texting the admin on Telegram, who then manually blocks the slot on the calendar. There is no automated enforcement of booking rules such as the 72-hour advance requirement or certification checks, and conflict resolution and tiebreaking requires manual intervention every week. Slot wastage also occurs when bands hold multiple slots without committing, depriving other users of practice time. Additionally, last users of the MR often forget to clear the dehumidifier. 
To address these challenges, we are building JukeBox Booking System, a full music room operations platform. The system will automate the weighted bidding process with fairness rules and transparent outcomes, sync confirmed bookings to Google Calendar, notify members via Telegram, and introduce post-booking room condition verification to ensure accountability across all 66+ members.
Aim 
Our aim is to design and implement a web application that simplifies the booking process for JukeBox. The system will automate the bidding process, centralize booking requests, and synchronize confirmed bookings with a shared Google Calendar. We will also make sure that the system will surface bidding results to the admin for review and manual override before finalisation. By providing a structured platform for both bands and individuals to request bookings, the application reduces manual administrative work for the logistics head and minimizes delays caused by message-based booking confirmations.
Through this project, we also aim to strengthen our understanding of software engineering and database management. Developing this application will allow us to gain practical experience in building a full-stack web system, structuring and managing data effectively, and designing features that address real operational needs within the JukeBox interest group.


Team Poster

Liftoff poster
User Stories
Logistics head
As the logistics head, I want to create booking cycles with available slots, rooms, and bidding rules so that each round can run without manual coordination.
As the logistics head, I want to review allocation results and override exceptional cases so that I can handle real-world scheduling issues. 
As the logistics head, I want confirmed bookings to sync to Google Calendar so that the shared calendar stays updated automatically.
As the logistics head, I want users to submit a post-booking room photo so that I can check whether the room was left clean and equipment is still present.
As the logistics head, I want the system to compare submitted room photos with a clean reference photo so that suspicious room conditions can be flagged for review.
Band leader
As a band leader, I want to distribute bidding points across preferred slots so that my band has a fair chance of getting suitable practice times.
As a band leader, I wish to receive notifications to remind me to submit my bookings so I do not miss the booking cycle.
Individuals 
As an individual user, I want to request available leftover slots after band allocation so that I can book practice time without messaging the logistics head.
As a user, I want to see whether my booking was confirmed, waitlisted, or rejected so that I know what action to take next.
As a room user, I want a simple checklist before ending my booking so that I know what items must be returned or cleaned up.

Userflow 

Userflow diagram
Features
Weighted automated bidding allocation system 
Band practice booking
Each week the band bidding window will be opened for band bookings first, where band leaders bid on behalf of their bands. There are three types of bands, normal bands, performance bands and ad-hoc/senior bands. Currently, the MR bookings operate in 2 hour blocks from 8am to 12am, giving a total of 8 slots each day. At any point of time if the admin wishes to change the slots to odd intervals (i.e. from 7am to 11pm) he or she can do so using the system. 

For band bookings, the bidding opens as early as desired for any future week, but the band leaders must submit all bids for the following week by Thursday 12pm. Based on the final bids, our system will push the booking results after the deadline. 

For each week, a band leader may bid up to 3 slots ranked by preference. The rankings are submitted using bidding points, where the first choice translates to 3 points, second choice translates to 2 points and third choice translates to 1 point. Nearer to performance dates, performance bands will receive more priority and their respective bidding points will increase by 1. (I.e. First choice is 4 points, second choice is 3 points, third choice is 2 points.). For lower priority bands like ad-hoc and senior bands, points will be reduced by 1, where they would only have 2 choices. 

Bands can also earn additional bid points through contributions to Jukebox events, where these contributions are tracked by the admin and applied as a point bonus. 


Below is a table to visualise the bidding points each type of bands receive. 

ranking
points (normal band)
points (performance band)
points (ad-hoc/senior bands)
1st choice
3 points
4 points
2 points 
2nd choice
2 points
3 points
1 point
3rd choice
1 point
2 points
-


After the bidding deadline, the system computes the band allocation using the following slot allocation algorithm. First, for each slot, collect the bids and their values, the band with the highest bid value for a slot is assigned the slot. If there is a tie where both bands choose the same slot with same bidding points, the tiebreak will be resolved by a random selection for fairness. A band that loses a tiebreak on their first choice is given priority consideration for their second choice and so on, so as to reduce the probability that a band ends up with no slots. The system produces a suggested allocation view for the admin, clearly indicating tiebreak outcomes and any priority consideration. The admin is then allowed to modify or keep the suggested bids based on any special request by the band. 

The following pictures show an example of the band booking allocation. Bands first submit their bids and the system records it as such: 


Sample bidding sheet 

Bands like Horses ate my homework and MY DaWG are examples of performance bands where their first choice is worth 4 points. 

Based off the bids, the system pushes the final bookings:

Sample outcome sheet


During performance days the slots are blocked out as instruments will all be shifted to the stage in preparation for the performance as such: 


Sample bidding sheet with blocked out events

For tie breaking, an example will be as such. Notice that for Friday, Horses at my homework and The 6and had two ties from 8-10pm and 10pm-12am. 

Sample bidding sheet with ties and cascading priority

Since the system resolved the first tie by randomly allocating the 8-10pm slot to Horses ate my homework, by the cascading priority rule for the next tie, The 6and receives priority over Horses ate my homework.


Sample outcome sheet resolving ties

Before confirming the slots that the system pushed, the admin can manually reassign any slot to a different band, override the algorithm’s suggestion due to conflicting interests, or consider contextual factors not captured by the algorithm. One example of such is that, nearer to performance dates, there may exist weaker bands that need more practice as compared to more experienced and well prepared bands. As such, priority will be given by the admin to the weaker bands for slock bookings. 

The system will be transparent about why a band lost their slot for fairness and all bands will be able to see an explanation if they lost a slot. 

To minimise the scenario where bands hog multiple slots but do not show up, depriving individual users from using the slots, each band is allocated up to 2 slots per week, even if they won 3 slots as this discourages excessive hoarding. The last choice will be let go of in the event where a band wins all 3 bids.

For all slots, band leaders must explicitly confirm the bookings within 4 days of the slot start time, so that individual users can book the slot in the event where they choose not to utilise the band slots. If the extra slot is not confirmed by the deadline, it is automatically released back into the pool for other users to book. 

Individual practice booking 
As mentioned above, individual residents who are MR-certified are allowed to book self-practice slots on a first-come-first-serve basis. The booking for individuals will open on Friday, 12am before the designated week, after the band bookings are released. And individuals must submit the booking 72 hours before the booking starts. For example, at Friday 6pm, the earliest slot I can select is Monday 6pm, however, any later than 6pm like 6:01pm, the earliest slot I can select is Monday 8pm. 

Each user is allowed to book multiple slots in a week and set one slot as their main slot, and the rest of the slots will be considered as extra slots. An extra slot can be taken by another user who has yet to secure a main slot for the week. This rule will ensure that everyone gets a chance to use the music room and prevents hoarding. 

The system will enforce this by marking each booking as primary or extra at the time of booking, and allowing a new booking by a slot-less user to claim the extra slot. It will also notify the original owner so that they can find another slot. 

Cancellations 
Slots that are cancelled at least 72 hours in advance are returned to the pool cleanly and late cancellations are logged. 
Below is a timeline to sum up the booking window. 

Booking window timeline visualised
Bookings UI 
The booking page will be colour coordinated to be intuitive. For instance, available slots are green, low demand (1-2 bands or 1-2 points) slots are yellow, medium demand (3-4 bands or 3-4 points) are yellow, high demand (5+ bands or 5+ points) are red in colour. Slots that are blocked by admin for events are coloured black. 


Colour coordinated slots reflecting popularity


Bands bid for practice slots through a structured form, while individuals book self-practice slots from a colour-coded availability calendar showing demand levels in real time. 

Band leaders can also submit the bids by ranking their choices on the bookings submission page. 


Sample booking page


Role Based Access and Access Control 
First, a user account may only be created and activated by the admin if the individual is a current resident of RVRC, and if the individual has attended an official MR workshop conducted in the current academic year. Admins are in charge of this certification. Graduated users or users who have lost certification will have their accounts suspended as they are no longer eligible. 

Second, authentication will be required, where only NUS emails are accepted. New accounts also require admin approval before activation, and admins assign the band leader role to band leaders. 

The system has three distinct roles: Admin, Band Leader, and Resident User, where each role will have a different interface and can access different features. 

ROLE
WHO
PERMISSIONS
Admin
Logistics head
Full system access, manual override on all slot assignments, user certification management, system configuration, view previous photo submissions
Band Leader
Leader of each band
Submit weekly bids on behalf of the band, confirm or release extra slots 
Resident User
Any MR-certified RV resident
Book self-practice slots, view calendar availability, submit photos

Admin access 
The admin panel provides full system control. The jukebox logistics head is the only user that can access this. 

The admin can view all submitted band bids with colour coded demand, override the slot assignments before confirming, block or unblock individual slots, confirm the weekly allocation to push for the Google Calendar and user notifications. 

The admin also can approve or reject new account registrations, grant or revoke MR certification status, assign or reassign band leader roles, assign performance bands nearer to performance dates, award bonus bidding points to bands, and suspend booking privileges 

The admin can view dehumidifier submission log with photo attachment, configure slot times and available days per week, set new bidding window open and close times and manage the list of active bands and members. 
Google Calendar 
The final bookings will be automatically pushed onto a shared Google Calendar allowing users who prefer to use the calendar to continue using it. 


Sample google calendar

Each event detail will include the booking type (band or individual), band name or username, slot time and link back to the system for extra actions such as cancellations. In the event where any slots are released or cancelled, the corresponding calendar event has to be deleted on the Google Calendar. 

To ensure that the bookings reflected on the Google Calendar, the system will periodically sync from Google Calendar to reflect any manual changes that the admin might have made in Google Calendar. 


Calendar in homepage
Telegram notification System
As telegram is the most used app among students, we will issue notifications through a telegram bot that will remind users. 

Notifications will be sent during the following events: 

When the bidding window opens all band leaders will be reminded to submit bids for upcoming week
24 hours before the bidding deadline, notifications will be sent to band leaders who have yet to submit their bids to remind them to book
When band booking slots are finalised by admin band leaders will be notified for the slots of the week. Members of each band will also be reminded. 
Slot confirmation reminders are sent to band leaders 4 days before the slot to remind them to confirm the slots, if not they will be released
Notifications will be sent when the slot is released to band leaders if they fail to confirm the slot in time individuals when the booking window for self practice slots open at 12am Friday 
Notifications will be sent when bookings are confirmed 
Notifications will be sent if extra slots of individuals are displaced
Notifications will be sent to the admin when slots are released 
The system will send reminders to the last user to clear the dehumidifier and bump them if no picture is submitted within 30 minutes of the end of the booking 
Admin will be reminded if the dehumidifier is not submitted 
Reminders will be sent if the slot is ending soon 15 minutes before the booking


Example of some notifications that may be received
Room condition / Dehumidifier check
The last user of the MR will be responsible for switching off all equipment and clearing the dehumidifier. The system will identify the last user of each day from the confirmed booking schedule, and notify the user using the telegram bot that they will have to clear the dehumidifier. 

At the end of the slot, the user will have to upload a video of themselves clearing the dehumidifier and upload a photo of the dehumidifier’s top panel confirming the ‘full’ indicator is off. The admin will be able to review all submissions. Failure to submit the video or the photo will result in more notifications and if at the end of the day, no photos are submitted, the admin will be contacted. 


Sample video of clearing the dehumidifier: 
https://drive.google.com/file/d/1Z6sCiw5v0O8Dyhr3VpehG-eTHdiSjsvy/view 



Dehumidifier with ‘full’ signal off


Photos submission page
Timeline
Milestone 1 
Bidding logic should be finalised and bands and users will be able to perform a simple bidding window round. The UI will display the results and simple booking submission and the backend should clearly resolve one booking cycle. 

Milestone 2 
Role workflows, booking cycle setup, full bidding allocation, tie breaking and confirmed booking display will be finished. Google Calendar sync and telegram bot will also be finished. Basic admin controls are also available.

Automated testing will be done to ensure that edge cases and tie breaking is managed properly and successfully. 
Milestone 3
All features are refined, and the dehumidifier photo video submission feature will be finalised. 

Testing (to be completed)
Testing for creating account 
Upon signing up, users receive the following message and await admin approval. 

Double check that account is stored in the database after creation 

Testing for different roles
Test case 1 band leader



Test case 2 individual 



Test case 3 admin 


Biddings testing 


To test: tie breaking // more than one band bids
Tech Stack

Frontend – React, JavaScript, HTML/CSS
building the interface, display schedule and results, allow users to submit booking requests
Backend – Node.js, Express.js, Python
handle booking logic, implement bidding system, communicate with database, connect to Google Calendar API 
Database – SQL 
store users, booking requests, finalized bookings, bidding data 
API – Google Calendar API, TelegramBot
auto push confirmed bookings, synchronise with shared calendar
Deployment / implementation
Vercel for front end hosting 
render for back end hosting 
mysql


Qualifications

We are familiar with programming languages such as Python and JavaScript, and have experience building small applications that involve user interfaces and data handling. Through CS2030s, we both have mastered object oriented programming principals and basic understanding of Git-based version control. Also, other than the basic Unix commands taught in CS2030S, we have self learnt some other useful Linux commands which can help us to manage the files more efficiently.

We also self-studied HTML and CSS to implement basic website formatting that can assist us with building an aesthetic and easy to navigate user interface. 

We have self-studied the algorithm design in addition to the CS2040S. which allows us to identify and use the most efficient data structure for the design of our booking system. 


Software Engineering
First, we will adopt the client-server (CS) architecture. with the frontend communicated with the backend through RESTful APIs. The backend server will handle the booking logic, bidding resolution and communication with external services such as Google calendar and Telegram APIs. 

The DB schema will be designed using relation models. Key entities like Users, Room, Bids, ConfirmBooking will be stored in separate tables and each table will contain bytes that cover the basic system requirement such as insertion, deletion, changing and search functions fully.

The backend will expose RESTful API endpoints to support system operations such as submitting bids, retrieving booking schedules, and managing user roles. Clear API contracts will be defined to ensure reliable communication between the frontend and backend.

Also, we will implement both unit testing and integration testing to verify the correctness of the system. Unit tests will validate individual backend functions such as the bidding allocation logic, as we write different user cases to test each individual part while integration tests will ensure that frontend and backend components interact correctly. We will design the test case in a way such that every test case is effective and efficient by introducing positive and negative testing. 

Authentication and authorization mechanisms will be implemented to protect the system. Role-based access control ensures that only authorized users (such as the logistics head) can modify booking schedules or administrative settings.

Last but not least, the system will be deployed using modern cloud hosting platforms. Continuous deployment will allow updates to be pushed efficiently while ensuring system stability.

For management of the development process, we will use Git-based version control. Changes to the codebase will be tracked through commits and branches, allowing us to collaborate efficiently and revert changes if necessary.


In addition to that, we will do continuous integration and deployment (CI and CD) to constantly test, run and deploy our code changes to ensure consistency and correct implementation of our code. 


Work Log
https://docs.google.com/spreadsheets/d/1njgrJuPr6lYqE6l8FXkYmQx7fQYV6cq2_nrRMzn0ROA/edit?gid=0#gid=0 
