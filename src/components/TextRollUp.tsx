import { motion } from "framer-motion";

export const TextRollUp = ({ text, className = "" }: { text: string; className?: string }) => {
  const words = text.split(" ");
  
  return (
    <div className={`overflow-hidden ${className}`}>
      {words.map((word, index) => (
        <span key={index} className="inline-block overflow-hidden mr-2">
          <motion.span
            initial={{ y: "100%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
            className="inline-block"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </div>
  );
};
