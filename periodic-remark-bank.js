/** BƯỚC 171 – Ngân hàng gợi ý nhận xét GIỮA KỲ. Có thể sửa câu chữ tại đây.
 * Mỗi khóa là môn/khối, mỗi mức CHỈ là tín hiệu từ hoạt động trắc nghiệm,
 * KHÔNG phải mức đánh giá chính thức theo Thông tư 27.
 */
export const PERIODIC_REMARK_BANK = {
  tin_hoc: {
    '3': {
      focus: 'kiến thức Tin học lớp 3',
      high: [
        'Em trả lời đúng phần lớn câu hỏi Tin học đã thực hiện và thể hiện khả năng nhận biết kiến thức được học.',
        'Qua các hoạt động hỏi đáp, em nắm khá chắc các nội dung Tin học đã được kiểm tra.'
      ],
      medium: [
        'Em trả lời đúng nhiều câu hỏi về nội dung Tin học lớp 3, song vẫn còn một số kiến thức cần củng cố.',
        'Em đã nhận biết được một số kiến thức Tin học qua trò chơi và cần ôn thêm các câu chưa trả lời đúng.'
      ],
      low: [
        'Qua các câu hỏi đã thực hiện, em cần được hướng dẫn thêm để củng cố kiến thức Tin học lớp 3.',
        'Em đã tham gia hoạt động học tập nhưng còn gặp khó khăn với một số câu hỏi Tin học; cần luyện tập thêm.'
      ]
    },
    '4': {
      focus: 'kiến thức và cách sử dụng công cụ Tin học lớp 4',
      high: [
        'Em trả lời đúng phần lớn câu hỏi về các nội dung Tin học lớp 4 đã học.',
        'Qua hoạt động tương tác, em nhận biết tốt những kiến thức Tin học lớp 4 đã được kiểm tra.'
      ],
      medium: [
        'Em đã hiểu một số nội dung Tin học lớp 4; cần tiếp tục củng cố các câu hỏi chưa chính xác.',
        'Em tham gia trả lời tích cực và cần ôn lại một số kiến thức Tin học lớp 4 đã được học.'
      ],
      low: [
        'Em cần được hỗ trợ thêm để nhận biết và vận dụng kiến thức Tin học lớp 4 trong các câu hỏi đã học.',
        'Em còn gặp khó khăn khi trả lời câu hỏi Tin học; cần ôn tập từng nội dung và thực hành có hướng dẫn.'
      ]
    },
    '5': {
      focus: 'kiến thức Tin học và giải quyết vấn đề ở lớp 5',
      high: [
        'Em trả lời đúng phần lớn câu hỏi Tin học lớp 5, thể hiện sự hiểu biết về những nội dung đã kiểm tra.',
        'Qua các hoạt động tương tác, em nắm khá chắc kiến thức Tin học lớp 5 trong phạm vi câu hỏi đã làm.'
      ],
      medium: [
        'Em nắm được một số kiến thức Tin học lớp 5 và cần luyện thêm các nội dung còn nhầm lẫn.',
        'Em đã thực hiện được nhiều câu hỏi Tin học; cần củng cố việc lựa chọn cách giải quyết phù hợp.'
      ],
      low: [
        'Em cần được hướng dẫn thêm để củng cố kiến thức Tin học lớp 5 và cách giải quyết các câu hỏi đã học.',
        'Em còn gặp khó khăn ở một số nội dung Tin học lớp 5; nên ôn theo từng bài và thực hành thêm.'
      ]
    }
  },
  cong_nghe: {
    '3': {
      focus: 'kiến thức Công nghệ lớp 3 và sử dụng sản phẩm công nghệ an toàn',
      high: [
        'Em trả lời đúng phần lớn câu hỏi về các nội dung Công nghệ lớp 3 đã học.',
        'Qua trò chơi, em nhận biết khá tốt kiến thức Công nghệ lớp 3 trong phạm vi câu hỏi được kiểm tra.'
      ],
      medium: [
        'Em nhận biết được một số nội dung Công nghệ lớp 3, cần ôn thêm các câu hỏi còn nhầm lẫn.',
        'Em có tiến triển trong hoạt động hỏi đáp Công nghệ; cần củng cố một số kiến thức đã học.'
      ],
      low: [
        'Em cần được hỗ trợ để nhận biết chắc hơn những nội dung Công nghệ lớp 3 đã học.',
        'Em còn gặp khó khăn khi trả lời câu hỏi Công nghệ; cần ôn lại từng bài và được hướng dẫn thêm.'
      ]
    },
    '4': {
      focus: 'kiến thức Công nghệ lớp 4 và vận dụng vào đời sống',
      high: [
        'Em trả lời đúng phần lớn câu hỏi Công nghệ lớp 4 trong các bài đã học.',
        'Qua hoạt động tương tác, em nhận biết khá tốt các kiến thức Công nghệ lớp 4 đã được kiểm tra.'
      ],
      medium: [
        'Em đã nhận biết được nhiều nội dung Công nghệ lớp 4; cần ôn lại các kiến thức còn nhầm lẫn.',
        'Em có khả năng trả lời một số câu hỏi Công nghệ và cần củng cố các nội dung đã học.'
      ],
      low: [
        'Em cần được hỗ trợ thêm để hiểu những kiến thức Công nghệ lớp 4 còn gặp khó khăn.',
        'Em cần ôn tập theo từng bài Công nghệ và luyện thêm cách lựa chọn phương án phù hợp.'
      ]
    },
    '5': {
      focus: 'kiến thức Công nghệ lớp 5, thiết kế và sử dụng sản phẩm an toàn',
      high: [
        'Em trả lời đúng phần lớn câu hỏi thuộc các nội dung Công nghệ lớp 5 đã thực hiện.',
        'Qua trò chơi, em nắm khá chắc kiến thức Công nghệ lớp 5 trong phạm vi câu hỏi đã làm.'
      ],
      medium: [
        'Em trả lời đúng nhiều câu hỏi Công nghệ lớp 5, cần củng cố thêm những nội dung còn chưa chính xác.',
        'Em đã nhận biết được một số kiến thức Công nghệ lớp 5 và cần ôn lại các bài còn nhầm lẫn.'
      ],
      low: [
        'Em cần được hướng dẫn thêm để củng cố những kiến thức Công nghệ lớp 5 còn gặp khó khăn.',
        'Em đã tham gia hỏi đáp nhưng cần luyện tập thêm các nội dung Công nghệ lớp 5 đã học.'
      ]
    }
  }
};
export const PERIODIC_REMARK_PERIODS = {
  GK1: 'Giữa học kỳ I',
  GK2: 'Giữa học kỳ II'
};
