import {
  courseRepository,
  type CreateCourseInput,
  type CreateHoleInput,
  type CourseWithHoles,
  type CourseWithStats,
} from '@/repositories'

export interface CreateCourseData {
  name: string
  city?: string
  state?: string
  country?: string
  par?: number
  numHoles?: number
  rating?: number
  slope?: number
  holes?: CreateHoleInput[]
}

export interface CourseResult {
  success: boolean
  course?: CourseWithHoles
  error?: string
}

export interface CoursesResult {
  success: boolean
  courses?: CourseWithStats[]
  error?: string
}

export class CourseService {
  async getCourses(options?: {
    search?: string
    take?: number
  }): Promise<CoursesResult> {
    try {
      const courses = await courseRepository.findMany({
        search: options?.search,
        isPublic: true,
        take: options?.take ?? 50,
      })

      return { success: true, courses }
    } catch (error) {
      console.error('Error fetching courses:', error)
      return { success: false, error: 'Failed to fetch courses' }
    }
  }

  async getCourseById(id: string): Promise<CourseResult> {
    const course = await courseRepository.findByIdWithHoles(id)

    if (!course) {
      return { success: false, error: 'Course not found' }
    }

    return { success: true, course }
  }

  async createCourse(data: CreateCourseData): Promise<CourseResult> {
    try {
      // Validate holes if provided
      if (data.holes) {
        const numHoles = data.numHoles ?? 18
        if (data.holes.length !== numHoles) {
          return {
            success: false,
            error: `Expected ${numHoles} holes, but got ${data.holes.length}`,
          }
        }

        // Validate hole numbers are sequential
        const holeNumbers = data.holes.map(h => h.holeNumber).sort((a, b) => a - b)
        for (let i = 0; i < holeNumbers.length; i++) {
          if (holeNumbers[i] !== i + 1) {
            return { success: false, error: 'Hole numbers must be sequential starting from 1' }
          }
        }
      }

      const course = await courseRepository.create(
        {
          name: data.name,
          city: data.city,
          state: data.state,
          country: data.country ?? 'USA',
          par: data.par ?? 72,
          numHoles: data.numHoles ?? 18,
          rating: data.rating,
          slope: data.slope,
          isPublic: true,
        },
        data.holes
      )

      return { success: true, course }
    } catch (error) {
      console.error('Error creating course:', error)
      return { success: false, error: 'Failed to create course' }
    }
  }

  async getCourseHoles(courseId: string) {
    return courseRepository.findHolesByCourseId(courseId)
  }

  /**
   * Calculate the total par for a course
   */
  calculateCoursePar(course: CourseWithHoles): number {
    return course.holes.reduce((sum, hole) => sum + hole.par, 0)
  }
}

// Singleton instance
export const courseService = new CourseService()
