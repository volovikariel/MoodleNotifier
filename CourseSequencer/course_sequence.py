from bs4 import BeautifulSoup
import requests
import re
import pathlib

if __name__ == '__main__':
    BASE_URL = "https://www.concordia.ca/"
    FACULTIES_URL = "https://www.concordia.ca/academics/undergraduate/calendar/current/courses-quick-links.html"

    # We use this file so that we don't make unnecessary calls to their servers
    soup = BeautifulSoup(open("Faculties.html"), "lxml")
    # soup = BeautifulSoup(requests.get(FACULTIES_URL).content, 'lxml')
    
    faculties = soup.select(".accordion-panel")
    # Example of faculty: Faculty of Fine Arts
    for faculty in faculties:
        faculty_name = faculty.select_one(".title").text.strip()
        departments = faculty.select(".content p")

        # Example of department: Music
        for department in departments:
            department_name = department.find(text=True)
            department_anchortags = department.select("a")
            subdepartments = [{"Name": department_anchortag.text, "URL": BASE_URL + department_anchortag.get("href")} for department_anchortag in department_anchortags]

            department_content = BeautifulSoup(requests.get(subdepartments[0]["URL"]).content, 'lxml')
            subdepartments_courses = [{"Name": subdepartments[0]["Name"], "Courses": courses} for courses in department_content.find_all(text=re.compile(r"\(\d+\s+credits\)"))]
            # print(subdepartments_courses)

            # Example of subdepartments: JAZZ, EAST, JPER
            for subdepartment in subdepartments:
                subdepartment_soup = BeautifulSoup(requests.get(subdepartment["URL"]).content, 'lxml')

                directory = f"./CourseSequences/{faculty_name}/Departments/{department_name}/"

                # Create the folder structure if it does not exist already
                pathlib.Path(directory).mkdir(parents=True, exist_ok=True)

                # The "/" represents a subfolder, and we're representing a path, so we need to replace it with something else
                filepath = directory + subdepartment["Name"].replace("/", "\\") + ".html"
                
                # Write all the subdepartment's HTML content into their respective files (e.g: JAZZ courses in its own file)
                with open(filepath, "w") as f:
                    anchortag_id = subdepartment["URL"].partition("#")[2]
                    # print(filepath)
                    subdepartment_courses = subdepartment_soup.select_one(f"a[id='{anchortag_id}']").find_parent("p")
                    f.write(subdepartment_courses.prettify())



# https://www.concordia.ca/academics/undergraduate/calendar/current/courses-quick-links.html