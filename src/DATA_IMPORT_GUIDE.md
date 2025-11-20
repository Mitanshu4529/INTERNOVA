# 📊 Internship Data Import Guide

## Overview
This guide will help you import your ~10,000 internship records from CSV/XLSX files into the MongoDB backend.

## Quick Start

### Option 1: Using the Web Interface (Recommended)

1. **Access the Data Import Manager**
   - You can integrate the `DataImportManager` component into your app
   - Or create a temporary admin page to access it

2. **Prepare Your CSV Files**
   - Your CSV/XLSX files should have columns like:
     - `title`, `job_title`, `position`, or `role`
     - `company`, `company_name`, or `organization`
     - `location`, `city`, or `place`
     - `stipend`, `salary`, or `compensation`
     - `skills`, `required_skills`, or `key_skills`
     - And other relevant fields

3. **Upload Process**
   - Select your CSV/XLSX file
   - Enter the source name (e.g., "internshala", "indeed", "prosple")
   - Check "Remove duplicates" to avoid duplicate entries
   - Click "Import Data"

4. **Monitor Progress**
   - The system will show how many records were imported
   - Any invalid records will be reported
   - Check the statistics to verify the import

### Option 2: Using the API Directly

If you want to programmatically import data, use this approach:

```javascript
// Read your CSV file
const csvContent = await file.text();

// Call the import API
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-cb26aef8/internships/import`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify({
      csvData: csvContent,
      source: 'internshala', // or 'indeed', 'prosple', etc.
      removeDupes: true
    })
  }
);

const result = await response.json();
console.log(result);
```

## Field Mapping

The import system automatically recognizes and maps various column names:

| Our Schema | Recognized Column Names |
|------------|------------------------|
| **title** | title, job_title, position, role, Title, internship_title |
| **company** | company, company_name, organization, Company, employer |
| **location** | location, city, place, Location, work_location |
| **type** | type, work_mode, mode, location_type (Remote/In-office/Hybrid) |
| **duration** | duration, internship_duration, period, Duration |
| **stipend** | stipend, salary, compensation, pay, Stipend |
| **description** | description, job_description, details, Description, about, responsibilities |
| **skills** | skills, required_skills, key_skills, Skills, skill, technologies |
| **posted** | posted, posted_date, created_at, date_posted, Posted |
| **status** | status, Status (Active/Closed) |
| **min_cgpa** | min_cgpa, cgpa, minimum_cgpa, required_cgpa |
| **eligible_years** | eligible_years, year, years, class |
| **experience** | experience, experience_level, required_experience |

## Data Format Examples

### Example 1: Internshala Format
```csv
title,company,location,stipend,duration,skills,posted
Software Developer Intern,TechCorp,Remote,"₹15,000/month",3 months,"Python, Django, React",2 days ago
Data Analyst Intern,DataCo,Mumbai,"₹20,000/month",6 months,"Excel, SQL, Tableau",1 week ago
```

### Example 2: Indeed Format
```csv
job_title,company_name,city,salary,internship_duration,required_skills,date_posted
Full Stack Developer,WebSolutions,Bangalore,15000,3 months,"JavaScript, Node.js, MongoDB",2023-11-01
Marketing Intern,BrandHub,Delhi,12000,6 months,"Social Media, Content Writing",2023-11-05
```

### Example 3: Prosple Format
```csv
position,organization,place,compensation,period,key_skills,Posted
Backend Engineer Intern,CloudTech,Hybrid - Pune,₹18000,4 months,"Java, Spring Boot, MySQL",Recently
UX Design Intern,DesignLab,Remote,₹10000,3 months,"Figma, Adobe XD, Prototyping",1 day ago
```

## Important Notes

### 1. File Size Limits
- For files > 5MB, consider splitting into multiple smaller files
- Import in batches of 2,000-3,000 records at a time for optimal performance

### 2. Duplicate Handling
- Duplicates are detected based on: `title + company name`
- Enable "Remove duplicates" to automatically skip duplicates
- MongoDB will also reject exact duplicate IDs

### 3. Data Validation
- Required fields: `title`, `company`, `id`
- Records missing required fields will be marked as invalid
- Invalid records are logged and can be reviewed

### 4. Company Mapping
The system automatically generates a `companyId` based on the company name. When a company logs in:
- The system matches their profile company name with internship company names
- Companies only see internships where `companyId` matches their profile

To improve matching:
- Ensure consistent company name formatting
- Use the exact company name when creating company accounts

## Workflow Integration

### For Students:
1. All imported internships appear in the student feed
2. Filters work based on imported data:
   - Skills matching
   - Location filtering
   - Stipend range
   - Work type (Remote/In-office/Hybrid)
3. Match scores calculated based on student profile and internship requirements

### For Companies:
1. Companies see internships where the company name matches their profile
2. They can edit/update their internships
3. Applications from students appear in their dashboard
4. They can contact students and manage applications

## Testing the Import

1. **Small Test First**
   - Start with a small CSV file (10-20 records)
   - Verify the data appears correctly in the student feed
   - Check that filtering and search work properly

2. **Check Statistics**
   - Use the "Database Statistics" section
   - Verify the count of imported records
   - Check the breakdown by source

3. **Verify Data Quality**
   - Open a few internship listings
   - Check that skills are properly parsed
   - Verify stipend amounts are correct
   - Ensure descriptions are readable

## Troubleshooting

### Problem: XLSX files not importing
**Solution**: Convert XLSX to CSV first using Excel/Google Sheets:
- Open the XLSX file
- File → Save As → CSV (Comma delimited)
- Use the CSV file for import

### Problem: Special characters appearing incorrectly
**Solution**: Ensure your CSV is UTF-8 encoded:
- In Excel: Save As → Tools → Web Options → Encoding → Unicode (UTF-8)
- In Google Sheets: It's UTF-8 by default

### Problem: Skills not parsing correctly
**Solution**: Ensure skills are separated by commas:
- Good: "Python, Django, React"
- Bad: "Python and Django and React"

### Problem: Company can't see their internships
**Solution**: 
- Check that the company name in the CSV matches the company profile name exactly
- Use consistent casing (e.g., "TechCorp" not "techcorp" or "TECHCORP")
- Update the company profile or re-import with corrected company names

## Next Steps After Import

1. **Verify Company Access**
   - Log in as a company
   - Verify they can see their internships
   - Test editing functionality

2. **Test Student Features**
   - Log in as a student
   - Add skills to profile
   - Verify internships are filtered based on skills
   - Test search and filters

3. **Check Applications Flow**
   - Apply to some internships as a student
   - Verify applications appear in company dashboard
   - Test messaging between company and student

## API Endpoints Reference

```
POST /internships/import
  - Imports CSV data
  - Body: { csvData: string, source?: string, removeDupes?: boolean }

GET /internships/stats
  - Returns database statistics

GET /internships
  - Returns all internships

DELETE /internships/clear-all
  - Clears all internships (use with caution!)
  - Body: { confirm: 'YES_DELETE_ALL' }
```

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Review the invalid records section after import
3. Verify your CSV format matches the examples above
4. Try importing a smaller test file first

---

**Ready to import?** Use the `DataImportManager` component or integrate it into your admin panel!
