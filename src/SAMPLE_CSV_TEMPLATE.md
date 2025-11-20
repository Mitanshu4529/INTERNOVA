# Sample CSV Templates for Data Import

## Template 1: Standard Format

```csv
title,company,location,type,duration,stipend,skills,description,posted,status
Software Developer Intern,TechCorp,Bangalore,Remote,3 months,"₹15,000/month","Python, Django, React","Develop web applications using modern frameworks",2 days ago,Active
Data Analyst Intern,DataCo,Mumbai,In-office,6 months,"₹20,000/month","Excel, SQL, Tableau","Analyze business data and create reports",1 week ago,Active
Marketing Intern,BrandHub,Delhi,Hybrid,3 months,"₹12,000/month","Social Media, Content Writing, Canva","Create engaging content for social media platforms",3 days ago,Active
UI/UX Design Intern,DesignLab,Remote,Remote,4 months,"₹10,000/month","Figma, Adobe XD, Prototyping","Design user interfaces for mobile applications",1 day ago,Active
Backend Developer Intern,CloudTech,Pune,Hybrid,6 months,"₹18,000/month","Java, Spring Boot, MySQL","Build scalable backend services",5 days ago,Active
```

## Template 2: Internshala-like Format

```csv
job_title,company_name,city,work_mode,internship_duration,salary,required_skills,job_description,date_posted,Status
Full Stack Developer,WebSolutions,Bangalore,Work From Home,3 months,15000,"JavaScript, Node.js, MongoDB","Build and maintain web applications. Work with modern tech stack.",2023-11-10,Active
Mobile App Developer,AppMasters,Hyderabad,Office,6 months,22000,"React Native, Firebase, API Integration","Develop cross-platform mobile applications",2023-11-08,Active
Content Writer,ContentHub,Chennai,Hybrid,3 months,10000,"Content Writing, SEO, WordPress","Write blog posts and website content",2023-11-12,Active
Graphic Designer,CreativeStudio,Mumbai,Office,4 months,12000,"Photoshop, Illustrator, CorelDraw","Create visual designs for marketing materials",2023-11-09,Active
Business Analyst,ConsultCo,Delhi,Work From Home,6 months,25000,"Excel, PowerPoint, Data Analysis","Analyze business processes and suggest improvements",2023-11-11,Active
```

## Template 3: Indeed-like Format

```csv
position,organization,place,mode,period,compensation,key_skills,details,Posted,status
Backend Engineer,TechStartup,Bangalore - In Office,In-office,3-6 months,₹18000/month,"Python, Flask, PostgreSQL, Docker","We are looking for a backend engineer to join our team. You will work on building APIs and database systems.",Recently,Active
Frontend Developer,DigitalAgency,Remote - India,Remote,3 months,₹15000/month,"HTML, CSS, JavaScript, React","Create responsive web interfaces. Must have portfolio.",1 week ago,Active
Data Science Intern,AILabs,Pune - Hybrid,Hybrid,6 months,₹20000/month,"Python, Machine Learning, TensorFlow","Work on machine learning projects. Basic ML knowledge required.",2 days ago,Active
DevOps Intern,CloudServices,Hyderabad,In-office,4 months,₹16000/month,"AWS, Docker, Kubernetes, CI/CD","Manage cloud infrastructure and deployments.",3 days ago,Active
QA Tester,SoftwareCo,Chennai,Hybrid,3 months,₹12000/month,"Manual Testing, Selenium, JIRA","Test software applications and report bugs.",5 days ago,Active
```

## Template 4: With Advanced Fields

```csv
title,company,location,type,duration,stipend,skills,description,posted,status,min_cgpa,eligible_years,experience,openings,deadline
Python Developer,TechGiant,Bangalore,Remote,6 months,"₹25,000/month","Python, Django, REST API, Git","Develop backend systems for enterprise applications",Just now,Active,7.5,"3rd Year, 4th Year",Beginner,5,2024-01-15
React Developer,StartupXYZ,Mumbai,In-office,3 months,"₹18,000/month","React, JavaScript, Redux, TypeScript","Build modern web applications",1 day ago,Active,7.0,"2nd Year, 3rd Year, 4th Year",Beginner,3,2024-01-20
Machine Learning Intern,AITech,Hyderabad,Hybrid,6 months,"₹30,000/month","Python, TensorFlow, PyTorch, ML","Work on cutting-edge ML projects",2 days ago,Active,8.0,"3rd Year, 4th Year",Intermediate,2,2024-01-25
DevOps Engineer,CloudCorp,Pune,Remote,4 months,"₹22,000/month","AWS, Docker, Kubernetes, Jenkins","Manage cloud infrastructure",3 days ago,Active,7.2,All Years,Beginner,4,2024-02-01
Android Developer,MobileFirst,Delhi,In-office,3 months,"₹20,000/month","Kotlin, Android Studio, Firebase","Develop native Android applications",1 week ago,Active,7.0,"3rd Year, 4th Year",Beginner,3,2024-01-30
```

## Template 5: Prosple-like Format

```csv
role,employer,location_type,duration_months,monthly_stipend,skills_required,responsibilities,posted_on,active
Software Engineering Intern,Microsoft India,Hybrid - Bangalore,6,35000,"C++, System Design, Algorithms","Work on Windows development team. Contribute to core features.",2023-11-10,Yes
Product Management Intern,Amazon,In-office - Mumbai,3,30000,"Product Strategy, Analytics, Communication","Assist in product launches. Conduct market research.",2023-11-12,Yes
Finance Intern,Goldman Sachs,In-office - Bangalore,6,40000,"Financial Modeling, Excel, Python","Analyze financial data. Create investment reports.",2023-11-08,Yes
Marketing Intern,Unilever,Hybrid - Delhi,4,25000,"Brand Management, Digital Marketing, Analytics","Support brand campaigns. Analyze consumer insights.",2023-11-11,Yes
HR Intern,Deloitte,Remote,3,20000,"Recruitment, Employee Relations, HR Analytics","Assist in recruitment process. Handle employee queries.",2023-11-09,Yes
```

## Notes for CSV Preparation

### 1. **Column Headers**
- First row must be column names
- Can use any of the recognized variations (see DATA_IMPORT_GUIDE.md)
- Case doesn't matter (title, Title, TITLE all work)

### 2. **Required Fields**
At minimum, include:
- Title (or job_title, position, role)
- Company (or company_name, organization)

### 3. **Skills Format**
- Use commas to separate: `Python, Django, React`
- Avoid: `Python and Django and React`
- Alternative separators supported: `;` `|` `/`

### 4. **Stipend Format**
Supports various formats:
- `₹15,000/month`
- `15000`
- `15000 per month`
- `Unpaid`
- `Performance based`

### 5. **Location/Type**
- Location: Any city name or "Remote"
- Type: `Remote`, `In-office`, `Hybrid`, `Work From Home`
  - System auto-detects and normalizes

### 6. **Dates**
- Relative: `2 days ago`, `1 week ago`, `Recently`
- Absolute: `2023-11-10`, `10-Nov-2023`

### 7. **Status**
- Active/Open: Will show to students
- Closed/Expired/Inactive: Will be marked as closed

### 8. **File Encoding**
- Save as UTF-8 to avoid character issues
- In Excel: Save As → Tools → Web Options → Encoding → UTF-8
- In Google Sheets: Download as CSV (automatically UTF-8)

## Mixing Different Formats

You can mix and match columns from different sources! The system will:
1. Auto-detect all recognized column names
2. Map them to the standard schema
3. Handle missing fields gracefully

Example with mixed columns:
```csv
job_title,company_name,location,work_mode,duration,salary,skills,description,posted
Developer,CompanyA,City1,Remote,3 months,15000,"Skill1, Skill2","Description",Recently
```

This flexibility allows you to:
- Import from multiple sources without reformatting
- Merge data from Internshala, Indeed, Prosple, etc.
- Add custom fields that will be preserved

## Quick Test

Before importing 10,000 records, test with a small file:

```csv
title,company,location,stipend,skills,posted
Test Intern 1,TestCo,Remote,10000,"Python, React",Just now
Test Intern 2,TestCo,Mumbai,15000,"Java, Spring",1 day ago
Test Intern 3,AnotherCo,Bangalore,20000,"JavaScript, Node",2 days ago
```

1. Save this as `test.csv`
2. Import via the Data Import Manager
3. Verify in Database Statistics
4. Check student dashboard to see listings
5. If successful, proceed with your full dataset!

---

Ready to import? Use any of these templates or your existing format! 🚀
